// authentication.js (slightly hardened)
const CLIENT_ID = process.env.CLIENT_ID || "zapier-myapp-001";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "39c4325efb1993344ff533646642d3fa";
const HOST = "https://4a82c39cea26.ngrok-free.app"; // centralize host, no leading/trailing spaces

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

    // zapier helper that throws with a helpful error message on non-2xx
    response.throwForStatus();

    if (!response.data || !response.data.access_token) {
      throw new Error(`Token response missing access_token. Full response: ${JSON.stringify(response.data)}`);
    }

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type || 'Bearer',
    };
  } catch (err) {
    // Add context for debugging in Zapier editor
    throw new Error(`getAccessToken failed: ${err.message}`);
  }
};

const refreshAccessToken = async (z, bundle) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: bundle.authData.refresh_token,
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
      throw new Error(`Refresh response missing access_token. Full response: ${JSON.stringify(response.data)}`);
    }

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type || 'Bearer',
    };
  } catch (err) {
    throw new Error(`refreshAccessToken failed: ${err.message}`);
  }
};

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
    refreshAccessToken,
    autoRefresh: true,
  },
  fields: [],
  test,
  connectionLabel: (z, bundle) => {
    const data = bundle.testResult || bundle.authData || {};
    return data.username || data.email || `User ${data.user_id || ''}`.trim();
  },
};
