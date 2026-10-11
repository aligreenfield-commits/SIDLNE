# Signs in to the App Store Connect API with the key, before Xcode tries to.
# Usage: ruby asc-check.rb KEY_PATH KEY_ID ISSUER_ID
# Prints a plain-English result and exits 1 if Apple rejects the key.
require "openssl"
require "json"
require "base64"
require "net/http"

key_path, key_id, issuer = ARGV
def b64(s) = Base64.urlsafe_encode64(s, padding: false)

key = OpenSSL::PKey::EC.new(File.read(key_path))
header = b64({ alg: "ES256", kid: key_id, typ: "JWT" }.to_json)
now = Time.now.to_i
payload = b64({ iss: issuer, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }.to_json)
der = key.sign(OpenSSL::Digest.new("SHA256"), "#{header}.#{payload}")
r, s = OpenSSL::ASN1.decode(der).value.map { |v| v.value.to_s(2).rjust(32, "\0") }
token = "#{header}.#{payload}.#{b64(r + s)}"

uri = URI("https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.gmail.sidlne&limit=1")
res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
  http.get(uri, "Authorization" => "Bearer #{token}")
end

case res.code
when "200"
  apps = JSON.parse(res.body)["data"] || []
  puts "Apple accepted API key #{key_id}."
  puts apps.empty? ? "::warning::No app with bundle ID com.gmail.sidlne in App Store Connect yet." : "Found the SIDLNE app record."
when "401"
  puts "::error::Apple rejected API key #{key_id} (401). The key text in APP_STORE_CONNECT_KEY is not from AuthKey_#{key_id}.p8, or that key was revoked, or the Issuer ID is wrong."
  exit 1
else
  puts "::error::App Store Connect API returned #{res.code}: #{res.body[0, 300]}"
  exit 1
end
