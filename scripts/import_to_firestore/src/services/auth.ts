// auth.ts
export async function getAccessToken(credentialPath: string): Promise<string> {
  const credentials = JSON.parse(await Deno.readTextFile(credentialPath))
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const jwtClaim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  }

  const header = { alg: "RS256", typ: "JWT" }
  const encoder = new TextEncoder()
  const toBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

  const headerB64 = toBase64Url(header)
  const claimB64 = toBase64Url(jwtClaim)
  const toSign = `${headerB64}.${claimB64}`

  const keyData = credentials.private_key.replace(/-----.*-----|\n/g, "")
  const keyBuffer = new Uint8Array(
    [...atob(keyData)].map((c) => c.charCodeAt(0)),
  ).buffer

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(toSign),
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const jwt = `${toSign}.${sigB64}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  const { access_token } = await res.json()
  if (!access_token) throw new Error("アクセストークンの取得に失敗しました")

  return access_token
}
