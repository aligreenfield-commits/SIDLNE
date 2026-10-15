# Fills in the App Store listing for SIDLNE through the App Store Connect API and
# (optionally) submits the newest build for App Review.
#
# Usage: ruby appstore-submit.rb KEY_PATH KEY_ID ISSUER_ID
# Environment:
#   SUBMIT=true            submit for review after filling everything in
#   REVIEW_EMAIL / REVIEW_PASSWORD     demo account for Apple's reviewer
#   CONTACT_NAME / CONTACT_PHONE / CONTACT_EMAIL   who Apple contacts about the review
# Content comes from appstore/listing.json and appstore/screenshots/*.png.
# Needs an Admin (or App Manager) App Store Connect API key.
require "openssl"
require "json"
require "base64"
require "net/http"
require "digest"

key_path, key_id, issuer = ARGV
BUNDLE = "com.gmail.sidlne"
ROOT = File.expand_path("../..", __dir__)
LISTING = JSON.parse(File.read(File.join(ROOT, "appstore/listing.json")))
SHOTS = Dir[File.join(ROOT, "appstore/screenshots/*.png")].sort
SHOT_TYPE = "APP_IPHONE_67" # 6.9" and 6.7" iPhones (1320 x 2868)
EDITABLE = %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED INVALID_BINARY].freeze

API_BASE = ENV.fetch("ASC_API_BASE", "https://api.appstoreconnect.apple.com")
KEY = OpenSSL::PKey::EC.new(File.read(key_path))
def b64(s) = Base64.urlsafe_encode64(s, padding: false)

def token(key_id, issuer)
  header = b64({ alg: "ES256", kid: key_id, typ: "JWT" }.to_json)
  now = Time.now.to_i
  payload = b64({ iss: issuer, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }.to_json)
  der = KEY.sign(OpenSSL::Digest.new("SHA256"), "#{header}.#{payload}")
  r, s = OpenSSL::ASN1.decode(der).value.map { |v| v.value.to_s(2).rjust(32, "\0") }
  "#{header}.#{payload}.#{b64(r + s)}"
end
TOKEN = token(key_id, issuer)

class ApiError < StandardError
  attr_reader :status, :body
  def initialize(status, body, what)
    @status = status
    @body = body
    errors = (JSON.parse(body)["errors"] rescue nil) || []
    lines = errors.map { |e| [e["title"], e["detail"]].compact.join(": ") }
    # Apple lists what blocks a submission under meta.associatedErrors
    errors.each do |e|
      (e.dig("meta", "associatedErrors") || {}).each do |_, list|
        Array(list).each { |a| lines << "  - #{[a["code"], a["detail"] || a["title"]].compact.join(": ")}" }
      end
    end
    details = lines.empty? ? nil : lines.join(" | ")
    super("#{what} failed (HTTP #{status}): #{details || body.to_s[0, 400]}")
  end
end

def api(method, path, body = nil, ok_missing: false)
  uri = URI(path.start_with?("http") ? path : "#{API_BASE}#{path}")
  req = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch, delete: Net::HTTP::Delete }[method].new(uri)
  req["Authorization"] = "Bearer #{TOKEN}"
  if body
    req["Content-Type"] = "application/json"
    req.body = body.to_json
  end
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", read_timeout: 120) { |h| h.request(req) }
  return nil if ok_missing && res.code == "404"
  raise ApiError.new(res.code, res.body, "#{method.upcase} #{uri.path}") unless res.code.start_with?("2")
  res.body.to_s.empty? ? {} : JSON.parse(res.body)
end

def step(msg) = puts("▸ #{msg}")
def rel(type, id) = { data: { type: type, id: id } }

# --- App and version -----------------------------------------------------------
app = api(:get, "/v1/apps?filter[bundleId]=#{BUNDLE}&limit=1")["data"].first
abort "::error::No app with bundle ID #{BUNDLE} in App Store Connect." unless app
app_id = app["id"]
step "App: #{app.dig("attributes", "name")} (#{app_id})"

versions = api(:get, "/v1/apps/#{app_id}/appStoreVersions?filter[platform]=IOS&limit=20")["data"]
state = ->(v) { v.dig("attributes", "appVersionState") || v.dig("attributes", "appStoreState") }
if (busy = versions.find { |v| %w[WAITING_FOR_REVIEW IN_REVIEW].include?(state[v]) })
  puts "::notice::Version #{busy.dig("attributes", "versionString")} is already #{state[busy].tr("_", " ").downcase}. Nothing to do."
  exit 0
end
version = versions.find { |v| EDITABLE.include?(state[v]) }
unless version
  step "Creating version #{LISTING["version"]}"
  version = api(:post, "/v1/appStoreVersions", { data: { type: "appStoreVersions",
    attributes: { platform: "IOS", versionString: LISTING["version"], copyright: LISTING["copyright"], releaseType: LISTING["releaseType"] },
    relationships: { app: rel("apps", app_id) } } })["data"]
end
version_id = version["id"]
first_release = versions.none? { |v| %w[READY_FOR_SALE READY_FOR_DISTRIBUTION].include?(state[v]) }
step "Version #{version.dig("attributes", "versionString")} (#{state[version] || "new"})"

api(:patch, "/v1/appStoreVersions/#{version_id}", { data: { type: "appStoreVersions", id: version_id,
  attributes: { copyright: LISTING["copyright"], releaseType: LISTING["releaseType"] } } })

# --- Store text ------------------------------------------------------------------
# Write the listing in the app's primary language (set when the app was created)
locale = app.dig("attributes", "primaryLocale") || LISTING["locale"]
step "Primary language: #{locale}"
locs = api(:get, "/v1/appStoreVersions/#{version_id}/appStoreVersionLocalizations?limit=50")["data"]
loc = locs.find { |l| l.dig("attributes", "locale") == locale }
text = { description: LISTING["description"], keywords: LISTING["keywords"], promotionalText: LISTING["promotionalText"],
         supportUrl: LISTING["supportUrl"], marketingUrl: LISTING["marketingUrl"] }
text[:whatsNew] = LISTING["whatsNew"] if !first_release && LISTING["whatsNew"]
if loc
  api(:patch, "/v1/appStoreVersionLocalizations/#{loc["id"]}", { data: { type: "appStoreVersionLocalizations", id: loc["id"], attributes: text } })
else
  loc = api(:post, "/v1/appStoreVersionLocalizations", { data: { type: "appStoreVersionLocalizations",
    attributes: text.merge(locale: locale), relationships: { appStoreVersion: rel("appStoreVersions", version_id) } } })["data"]
end
step "Description, keywords and links set (#{locale})"

infos = api(:get, "/v1/apps/#{app_id}/appInfos?limit=10")["data"]
info = infos.find { |i| !%w[READY_FOR_DISTRIBUTION ACCEPTED].include?(i.dig("attributes", "state") || i.dig("attributes", "appStoreState")) } || infos.first
api(:patch, "/v1/appInfos/#{info["id"]}", { data: { type: "appInfos", id: info["id"], relationships: {
  primaryCategory: rel("appCategories", LISTING["primaryCategory"]),
  secondaryCategory: rel("appCategories", LISTING["secondaryCategory"]) } } })
info_locs = api(:get, "/v1/appInfos/#{info["id"]}/appInfoLocalizations?limit=50")["data"]
if info_locs.none? { |l| l.dig("attributes", "locale") == locale }
  info_locs << api(:post, "/v1/appInfoLocalizations", { data: { type: "appInfoLocalizations",
    attributes: { locale: locale, name: app.dig("attributes", "name") }, relationships: { appInfo: rel("appInfos", info["id"]) } } })["data"]
end
# Every language needs the privacy policy link; the subtitle goes on the primary one
info_locs.each do |il|
  attrs = { privacyPolicyUrl: LISTING["privacyPolicyUrl"] }
  attrs[:subtitle] = LISTING["subtitle"] if il.dig("attributes", "locale") == locale
  api(:patch, "/v1/appInfoLocalizations/#{il["id"]}", { data: { type: "appInfoLocalizations", id: il["id"], attributes: attrs } })
end
step "Subtitle, privacy policy and categories set"

rating = api(:get, "/v1/appInfos/#{info["id"]}/ageRatingDeclaration")["data"]
api(:patch, "/v1/ageRatingDeclarations/#{rating["id"]}", { data: { type: "ageRatingDeclarations", id: rating["id"], attributes: LISTING["ageRating"] } })
api(:patch, "/v1/apps/#{app_id}", { data: { type: "apps", id: app_id, attributes: { contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT" } } })
step "Age rating answers and content rights set"

# --- Price (free) and availability (everywhere) -----------------------------------
schedule = api(:get, "/v1/apps/#{app_id}/appPriceSchedule", ok_missing: true)&.dig("data")
priced = schedule && !api(:get, "/v1/appPriceSchedules/#{schedule["id"]}/manualPrices?limit=1", ok_missing: true).to_h.fetch("data", []).empty?
unless priced
  points = api(:get, "/v1/apps/#{app_id}/appPricePoints?filter[territory]=USA&limit=200")["data"]
  free = points.find { |p| p.dig("attributes", "customerPrice").to_f.zero? }
  api(:post, "/v1/appPriceSchedules", { data: { type: "appPriceSchedules", relationships: {
      app: rel("apps", app_id), baseTerritory: rel("territories", "USA"),
      manualPrices: { data: [{ type: "appPrices", id: "${free}" }] } } },
    included: [{ type: "appPrices", id: "${free}", attributes: { startDate: nil },
                 relationships: { appPricePoint: rel("appPricePoints", free["id"]) } }] })
  step "Price set to Free"
else
  step "Price already set"
end

if api(:get, "/v1/apps/#{app_id}/appAvailabilityV2", ok_missing: true).nil?
  territories = api(:get, "/v1/territories?limit=200")["data"].map { |t| t["id"] }
  api(:post, "/v2/appAvailabilities", { data: { type: "appAvailabilities", attributes: { availableInNewTerritories: true },
      relationships: { app: rel("apps", app_id),
        territoryAvailabilities: { data: territories.map { |t| { type: "territoryAvailabilities", id: "${#{t}}" } } } } },
    included: territories.map { |t| { type: "territoryAvailabilities", id: "${#{t}}", attributes: { available: true },
                                       relationships: { territory: rel("territories", t) } } } })
  step "Available in all #{territories.size} countries and regions"
else
  step "Availability already set"
end

# --- Screenshots -------------------------------------------------------------------
abort "::error::No screenshots in appstore/screenshots." if SHOTS.empty?
sets = api(:get, "/v1/appStoreVersionLocalizations/#{loc["id"]}/appScreenshotSets?limit=50")["data"]
set = sets.find { |s| s.dig("attributes", "screenshotDisplayType") == SHOT_TYPE } ||
      api(:post, "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: SHOT_TYPE },
        relationships: { appStoreVersionLocalization: rel("appStoreVersionLocalizations", loc["id"]) } } })["data"]
existing = api(:get, "/v1/appScreenshotSets/#{set["id"]}/appScreenshots?limit=50")["data"]
wanted = SHOTS.map { |f| [File.basename(f), Digest::MD5.file(f).hexdigest] }
have = existing.map { |s| [s.dig("attributes", "fileName"), s.dig("attributes", "sourceFileChecksum")] }
if have == wanted && existing.all? { |s| s.dig("attributes", "assetDeliveryState", "state") == "COMPLETE" }
  step "Screenshots up to date (#{SHOTS.size})"
else
  existing.each { |s| api(:delete, "/v1/appScreenshots/#{s["id"]}") }
  SHOTS.each do |file|
    bytes = File.binread(file)
    shot = api(:post, "/v1/appScreenshots", { data: { type: "appScreenshots",
      attributes: { fileName: File.basename(file), fileSize: bytes.bytesize },
      relationships: { appScreenshotSet: rel("appScreenshotSets", set["id"]) } } })["data"]
    shot.dig("attributes", "uploadOperations").each do |op|
      uri = URI(op["url"])
      req = Net::HTTP.const_get(op["method"].capitalize).new(uri)
      (op["requestHeaders"] || []).each { |h| req[h["name"]] = h["value"] }
      req.body = bytes.byteslice(op["offset"], op["length"])
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") { |h| h.request(req) }
      raise "Uploading #{File.basename(file)} failed (HTTP #{res.code})" unless res.code.start_with?("2")
    end
    api(:patch, "/v1/appScreenshots/#{shot["id"]}", { data: { type: "appScreenshots", id: shot["id"],
      attributes: { uploaded: true, sourceFileChecksum: Digest::MD5.hexdigest(bytes) } } })
  end
  # Apple processes the images; wait so a submission doesn't race it
  30.times do
    states = api(:get, "/v1/appScreenshotSets/#{set["id"]}/appScreenshots?limit=50")["data"].map { |s| s.dig("attributes", "assetDeliveryState", "state") }
    abort "::error::Apple couldn't process a screenshot (check its size: 1320 x 2868)." if states.include?("FAILED")
    break if states.all?("COMPLETE")
    sleep 5
  end
  step "Uploaded #{SHOTS.size} screenshots"
end

# --- Build ---------------------------------------------------------------------------
builds = api(:get, "/v1/builds?filter[app]=#{app_id}&filter[preReleaseVersion.version]=#{version.dig("attributes", "versionString")}" \
                   "&filter[processingState]=VALID&filter[expired]=false&sort=-uploadedDate&limit=1")["data"]
abort "::error::No processed build of version #{version.dig("attributes", "versionString")} yet. Wait for TestFlight processing and run again." if builds.empty?
build = builds.first
if build.dig("attributes", "usesNonExemptEncryption").nil?
  api(:patch, "/v1/builds/#{build["id"]}", { data: { type: "builds", id: build["id"], attributes: { usesNonExemptEncryption: false } } })
end
api(:patch, "/v1/appStoreVersions/#{version_id}/relationships/build", rel("builds", build["id"]))
step "Build #{build.dig("attributes", "version")} attached"

# --- App Review information ------------------------------------------------------------
first, last = ENV["CONTACT_NAME"].to_s.strip.split(/\s+/, 2)
review = { demoAccountRequired: true, demoAccountName: ENV["REVIEW_EMAIL"], demoAccountPassword: ENV["REVIEW_PASSWORD"],
           notes: LISTING["reviewNotes"], contactEmail: ENV["CONTACT_EMAIL"].to_s.strip }
review[:contactFirstName] = first if first
review[:contactLastName] = last if last
unless ENV["CONTACT_PHONE"].to_s.strip.empty?
  phone = ENV["CONTACT_PHONE"].strip.gsub(/[^\d+ ]/, " ").squeeze(" ").strip
  phone = "+1 #{phone}" if !phone.start_with?("+") && phone.delete(" ").length == 10 # US number without country code
  review[:contactPhone] = phone
end
review.delete(:demoAccountPassword) if review[:demoAccountPassword].to_s.empty?
detail = api(:get, "/v1/appStoreVersions/#{version_id}/appStoreReviewDetail", ok_missing: true)&.dig("data")
if !detail && (review[:contactFirstName].to_s.empty? || review[:contactLastName].to_s.empty? || review[:contactPhone].to_s.empty?)
  abort "::error::Everything else is filled in. Apple needs a contact for the review: add the APP_REVIEW_CONTACT_NAME " \
        "(first and last name) and APP_REVIEW_PHONE (starting with + and the country code, e.g. +1 555 123 4567) secrets " \
        "in Settings > Environments > NEW KEYS, then run this again."
end
if detail
  api(:patch, "/v1/appStoreReviewDetails/#{detail["id"]}", { data: { type: "appStoreReviewDetails", id: detail["id"], attributes: review } })
else
  detail = api(:post, "/v1/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes: review,
    relationships: { appStoreVersion: rel("appStoreVersions", version_id) } } })["data"]
end
detail = api(:get, "/v1/appStoreReviewDetails/#{detail["id"]}")["data"]["attributes"]
missing = %w[contactFirstName contactLastName contactPhone contactEmail].select { |k| detail[k].to_s.empty? }
step "App Review contact and demo account set#{missing.empty? ? "" : " (missing: #{missing.join(", ")})"}"

# --- Submit ------------------------------------------------------------------------------
unless ENV["SUBMIT"] == "true"
  puts "::notice::The App Store listing is filled in. Run again with submit checked to send it to App Review."
  exit 0
end
unless missing.empty?
  abort "::error::Apple needs a contact for the review. Add the APP_REVIEW_CONTACT_NAME and APP_REVIEW_PHONE secrets (NEW KEYS environment) and run again."
end

begin
  pending = api(:get, "/v1/reviewSubmissions?filter[app]=#{app_id}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5")["data"]
  submission = pending.first || api(:post, "/v1/reviewSubmissions", { data: { type: "reviewSubmissions",
    attributes: { platform: "IOS" }, relationships: { app: rel("apps", app_id) } } })["data"]
  begin
    api(:post, "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: {
      reviewSubmission: rel("reviewSubmissions", submission["id"]), appStoreVersion: rel("appStoreVersions", version_id) } } })
  rescue ApiError => e
    raise unless e.status == "409" && e.message =~ /already|ITEM_PART_OF_ANOTHER_SUBMISSION|duplicate/i
  end
  api(:patch, "/v1/reviewSubmissions/#{submission["id"]}", { data: { type: "reviewSubmissions", id: submission["id"], attributes: { submitted: true } } })
rescue ApiError => e
  puts "::error::Apple didn't accept the submission yet. #{e.message}"
  if e.message =~ /privacy|data collection|App Privacy/i
    puts "::error::Fill in App Privacy at appstoreconnect.apple.com > SIDLNE > App Privacy (answers are in APP_STORE.md), then run this again."
  end
  exit 1
end
puts "::notice::Submitted SIDLNE #{version.dig("attributes", "versionString")} (build #{build.dig("attributes", "version")}) for App Review. It goes live on the App Store automatically once approved (usually 1-3 days)."
