# Makes sure the app's bundle ID has the Push Notifications capability, so the
# App Store profile Xcode creates includes it. Needs an Admin App Store Connect key.
# Usage: ruby asc-push.rb KEY_PATH KEY_ID ISSUER_ID
require "openssl"
require "json"
require "base64"
require "net/http"

key_path, key_id, issuer = ARGV
BUNDLE = "com.gmail.sidlne"
def b64(s) = Base64.urlsafe_encode64(s, padding: false)

key = OpenSSL::PKey::EC.new(File.read(key_path))
header = b64({ alg: "ES256", kid: key_id, typ: "JWT" }.to_json)
now = Time.now.to_i
payload = b64({ iss: issuer, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }.to_json)
der = key.sign(OpenSSL::Digest.new("SHA256"), "#{header}.#{payload}")
r, s = OpenSSL::ASN1.decode(der).value.map { |v| v.value.to_s(2).rjust(32, "\0") }
TOKEN = "#{header}.#{payload}.#{b64(r + s)}"

def api(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |h|
    req = (method == :post ? Net::HTTP::Post : Net::HTTP::Get).new(uri)
    req["Authorization"] = "Bearer #{TOKEN}"
    if body
      req["Content-Type"] = "application/json"
      req.body = body.to_json
    end
    h.request(req)
  end
end

res = api(:get, "/v1/bundleIds?filter[identifier]=#{BUNDLE}&limit=5")
abort "::warning::Could not look up bundle ID #{BUNDLE} (HTTP #{res.code}); push notifications may be missing from this build." unless res.code == "200"
bundle = (JSON.parse(res.body)["data"] || []).find { |b| b.dig("attributes", "identifier") == BUNDLE }
abort "::warning::Bundle ID #{BUNDLE} isn't registered yet; push notifications may be missing from this build." unless bundle

res = api(:get, "/v1/bundleIds/#{bundle["id"]}/bundleIdCapabilities?limit=50")
caps = res.code == "200" ? (JSON.parse(res.body)["data"] || []).map { |c| c.dig("attributes", "capabilityType") } : []
if caps.include?("PUSH_NOTIFICATIONS")
  puts "Push Notifications is already enabled for #{BUNDLE}."
  exit 0
end

res = api(:post, "/v1/bundleIdCapabilities", {
  data: {
    type: "bundleIdCapabilities",
    attributes: { capabilityType: "PUSH_NOTIFICATIONS" },
    relationships: { bundleId: { data: { type: "bundleIds", id: bundle["id"] } } },
  },
})
if res.code.start_with?("2")
  puts "Enabled Push Notifications for #{BUNDLE}."
else
  puts "::warning::Could not enable Push Notifications for #{BUNDLE} (HTTP #{res.code}): #{res.body.to_s.gsub(/\s+/, " ")[0, 300]}. Turn it on at developer.apple.com > Identifiers > #{BUNDLE}."
end
