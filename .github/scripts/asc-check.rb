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
# A public fingerprint (safe to show) so you can tell whether the saved key changed between runs
pub = OpenSSL::PKey::EC.new(key.public_to_der)
puts "Key fingerprint: #{OpenSSL::Digest::SHA256.hexdigest(pub.to_der)[0, 12]}"
# The team's Issuer ID (shown above the Team Keys list; an identifier, not a secret)
KNOWN_ISSUER = "df23b593-b9db-4995-a523-a07b45cde228"

def token(key, key_id, claims)
  header = b64({ alg: "ES256", kid: key_id, typ: "JWT" }.to_json)
  now = Time.now.to_i
  payload = b64(claims.merge(iat: now, exp: now + 600, aud: "appstoreconnect-v1").to_json)
  der = key.sign(OpenSSL::Digest.new("SHA256"), "#{header}.#{payload}")
  r, s = OpenSSL::ASN1.decode(der).value.map { |v| v.value.to_s(2).rjust(32, "\0") }
  "#{header}.#{payload}.#{b64(r + s)}"
end

def get(tok)
  uri = URI("https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.gmail.sidlne&limit=1")
  Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.get(uri, "Authorization" => "Bearer #{tok}") }
end

# Team key with the configured Issuer ID, team key with the known Issuer ID, then individual key
attempts = [["team key, configured Issuer ID", { iss: issuer }]]
attempts << ["team key, known Issuer ID", { iss: KNOWN_ISSUER }] if issuer != KNOWN_ISSUER
attempts << ["individual key", { sub: "user" }]

attempts.each do |label, claims|
  res = get(token(key, key_id, claims))
  puts "#{label}: HTTP #{res.code}"
  # Apple's error explains the rejection (no secrets in it)
  puts "  Apple says: #{res.body.to_s.gsub(/\s+/, " ")[0, 400]}" unless res.code == "200"
  next unless res.code == "200"
  apps = JSON.parse(res.body)["data"] || []
  puts "Apple accepted API key #{key_id} (#{label})."
  puts apps.empty? ? "::warning::No app with bundle ID com.gmail.sidlne in App Store Connect yet." : "Found the SIDLNE app record."
  if label.start_with?("individual")
    puts "::error::Key #{key_id} is an Individual key. Xcode signing needs a Team key with Admin access (App Store Connect > Integrations > Team Keys)."
    exit 1
  end
  puts "::warning::The APP_STORE_CONNECT_ISSUER_ID setting is wrong; using the team's Issuer ID instead." if claims[:iss] != issuer
  File.write("#{key_path}.issuer", claims[:iss]) # the Issuer ID that worked, for xcodebuild
  exit 0
end

# Find out which key this text really belongs to: try the account's other Key IDs (labels, not secrets)
OTHER_KEY_IDS = %w[LRKVQL52JP 48A56P8KG8 2797G58G9M AZFWPW7W2P R8ZB3QUZY5] - [key_id]
OTHER_KEY_IDS.each do |other|
  res = get(token(key, other, { iss: issuer }))
  next unless res.code == "200"
  puts "::error::The text in APP_STORE_CONNECT_KEY belongs to key #{other}, not #{key_id}. Use the text of AuthKey_#{key_id}.p8, or set the Key ID to #{other} if that key has Admin access."
  exit 1
end

puts "::error::Apple rejected API key #{key_id} every way (401). The text in APP_STORE_CONNECT_KEY is not from AuthKey_#{key_id}.p8, or key #{key_id} was revoked."
exit 1
