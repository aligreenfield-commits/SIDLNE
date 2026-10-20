# Opens SIDLNE to the public through TestFlight: anyone with the link can install
# the newest build. Sets the beta review details (demo account, contact), the
# "What to test" notes, a "Public" tester group with a public link, adds the
# newest processed build to it and sends it to Apple's beta review (usually
# much faster than App Review). The link starts working once Apple approves.
#
# Usage: ruby testflight-public.rb KEY_PATH KEY_ID ISSUER_ID
# Environment: REVIEW_EMAIL / REVIEW_PASSWORD, CONTACT_NAME / CONTACT_PHONE / CONTACT_EMAIL
require "openssl"
require "json"
require "base64"
require "net/http"
require "digest"

key_path, key_id, issuer = ARGV
BUNDLE = "com.gmail.sidlne"
ROOT = File.expand_path("../..", __dir__)

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
      (e.dig("meta", "associatedErrors") || {}).each do |where, list|
        Array(list).each { |a| lines << "  - #{where}: #{[a["code"], a["detail"] || a["title"]].compact.join(": ")}" }
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
LISTING = JSON.parse(File.read(File.join(ROOT, "appstore/listing.json")))
WHAT_TO_TEST = "The newest SIDLNE: every team app in one family calendar (TeamSnap, SportsEngine, " \
  "LeagueApps, GameChanger, Sports Connect, Crossbar), carpools with other families, rides, " \
  "Game Day mix, schedule-change alerts and family chat. Tell us anything that looks off with " \
  "Send Beta Feedback (take a screenshot in TestFlight)."

app = api(:get, "/v1/apps?filter[bundleId]=#{BUNDLE}&limit=1")["data"].first
abort "::error::No app with bundle ID #{BUNDLE} in App Store Connect." unless app
app_id = app["id"]
step "App: #{app.dig("attributes", "name")} (#{app_id})"

# Newest processed build
builds = api(:get, "/v1/builds?filter[app]=#{app_id}&filter[processingState]=VALID&filter[expired]=false&sort=-uploadedDate&limit=1")["data"]
build = builds.first or abort("::error::No processed build yet. Wait for the iOS app workflow to upload one.")
step "Newest build: #{build.dig("attributes", "version")} (uploaded #{build.dig("attributes", "uploadedDate")})"

# Beta review details: who Apple contacts, and the demo sign-in
first, last = ENV["CONTACT_NAME"].to_s.strip.split(/\s+/, 2)
detail = api(:get, "/v1/apps/#{app_id}/betaAppReviewDetail")["data"]
attrs = { demoAccountRequired: true, demoAccountName: ENV["REVIEW_EMAIL"], demoAccountPassword: ENV["REVIEW_PASSWORD"],
          contactEmail: ENV["CONTACT_EMAIL"].to_s.strip, notes: LISTING["reviewNotes"] }
attrs[:contactFirstName] = first if first
attrs[:contactLastName] = last || first if first
unless ENV["CONTACT_PHONE"].to_s.strip.empty?
  attrs[:contactPhone] = ENV["CONTACT_PHONE"].strip.gsub(/[^\d+ ]/, " ").squeeze(" ").strip
end
api(:patch, "/v1/betaAppReviewDetails/#{detail["id"]}", { data: { type: "betaAppReviewDetails", id: detail["id"], attributes: attrs } })
step "Beta review contact and demo account set"

# Test information shown in TestFlight
loc_attrs = { description: LISTING["description"].to_s[0, 4000], feedbackEmail: ENV["CONTACT_EMAIL"].to_s.strip,
              marketingUrl: LISTING["marketingUrl"], privacyPolicyUrl: LISTING["privacyPolicyUrl"] }.compact
loc = api(:get, "/v1/apps/#{app_id}/betaAppLocalizations")["data"].find { |l| l.dig("attributes", "locale") == "en-US" }
if loc
  api(:patch, "/v1/betaAppLocalizations/#{loc["id"]}", { data: { type: "betaAppLocalizations", id: loc["id"], attributes: loc_attrs } })
else
  api(:post, "/v1/betaAppLocalizations", { data: { type: "betaAppLocalizations", attributes: loc_attrs.merge(locale: "en-US"),
    relationships: { app: rel("apps", app_id) } } })
end
bloc = api(:get, "/v1/builds/#{build["id"]}/betaBuildLocalizations")["data"].find { |l| l.dig("attributes", "locale") == "en-US" }
if bloc
  api(:patch, "/v1/betaBuildLocalizations/#{bloc["id"]}", { data: { type: "betaBuildLocalizations", id: bloc["id"], attributes: { whatsNew: WHAT_TO_TEST } } })
else
  api(:post, "/v1/betaBuildLocalizations", { data: { type: "betaBuildLocalizations", attributes: { locale: "en-US", whatsNew: WHAT_TO_TEST },
    relationships: { build: rel("builds", build["id"]) } } })
end
step "Test information set"

# Public tester group with a public link
group = api(:get, "/v1/apps/#{app_id}/betaGroups?limit=50")["data"].find { |g| g.dig("attributes", "name") == "Public" }
group_attrs = { publicLinkEnabled: true, publicLinkLimitEnabled: false, feedbackEnabled: true }
if group
  group = api(:patch, "/v1/betaGroups/#{group["id"]}", { data: { type: "betaGroups", id: group["id"], attributes: group_attrs } })["data"]
else
  group = api(:post, "/v1/betaGroups", { data: { type: "betaGroups", attributes: group_attrs.merge(name: "Public"),
    relationships: { app: rel("apps", app_id) } } })["data"]
end
api(:post, "/v1/betaGroups/#{group["id"]}/relationships/builds", { data: [{ type: "builds", id: build["id"] }] })
step "Build added to the Public group"

# Send the build to beta review
begin
  api(:post, "/v1/betaAppReviewSubmissions", { data: { type: "betaAppReviewSubmissions", relationships: { build: rel("builds", build["id"]) } } })
  step "Sent to Apple's TestFlight beta review"
rescue ApiError => e
  raise unless e.status == "409" || e.status == "422"
  puts "::notice::Beta review: #{e.message}"
end
state = api(:get, "/v1/builds/#{build["id"]}/buildBetaDetail")["data"].dig("attributes", "externalBuildState") rescue nil
puts "::notice::Build #{build.dig("attributes", "version")} TestFlight state: #{state || "unknown"}"
link = api(:get, "/v1/betaGroups/#{group["id"]}")["data"].dig("attributes", "publicLink")
puts "::notice::Public TestFlight link: #{link || "(appears after the first approval)"}"
