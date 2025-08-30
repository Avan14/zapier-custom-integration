// authentication.js (POC-friendly, no refresh token logic)
const CLIENT_ID = process.env.CLIENT_ID || "zapier-myapp-001";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "39c4325efb1993344ff533646642d3fa";
const HOST = "https://7205df21d48d.ngrok-free.app"; // centralize host, no leading/trailing spaces

const getAccessToken = async (z, bundle) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code: bundle.inputData.code,
    redirect_uri: bundle.inputData.redirect_uri || bundle.inputData.redirectUri || '',
  }).toString();

  try {
    const response = await z.request({
      url: `${HOST}/oauth/token`,
      method: "POST",
      body: params,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    response.throwForStatus();

    if (!response.data || !response.data.access_token) {
      throw new Error(`Token response missing access_token. Full response: ${JSON.stringify(response.data)}`);
    }

    // 🚫 ignore refresh_token completely
    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in || 3600,
      token_type: response.data.token_type || 'Bearer',
    };
  } catch (err) {
    throw new Error(`getAccessToken failed: ${err.message}`);
  }
};

// No refreshAccessToken needed — skip for POC

const test = async (z, bundle) => {
  if (!bundle.authData || !bundle.authData.access_token) {
    throw new Error('No access token present in bundle.authData for test. Ensure token exchange worked.');
  }

  try {
    const response = await z.request({
      url: `${HOST}/api/me`,
      headers: {
        Authorization: `Bearer ${bundle.authData.access_token}`,
      },
    });

    response.throwForStatus();
    return response.data;
  } catch (err) {
    throw new Error(`Auth test failed: ${err.message}`);
  }
};

module.exports = {
  type: "oauth2",
  oauth2Config: {
    authorizeUrl: {
      url: `${HOST}/oauth/authorize`,
      params: {
        client_id: CLIENT_ID,
        response_type: "code",
        // optionally include redirect_uri here:
        // redirect_uri: '{{bundle.inputData.redirect_uri}}'
      },
    },
    getAccessToken,
    // 🚫 removed refreshAccessToken
    autoRefresh: false, // tell Zapier not to try refresh
  },
  fields: [],
  test,
  connectionLabel: (z, bundle) => {
    const data = bundle.testResult || bundle.authData || {};
    return data.username || data.email || `User ${data.user_id || ''}`.trim();
  },
};
