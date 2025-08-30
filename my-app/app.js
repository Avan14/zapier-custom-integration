// app.js (authorize fixed by using authenticateHandler)
'use strict';

const express = require('express');
const OAuth2Server = require('oauth2-server');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: true,
  })
);

const clients = [
  {
    clientId: process.env.CLIENT_ID || 'zapier-myapp-001',
    clientSecret: process.env.CLIENT_SECRET || '39c4325efb1993344ff533646642d3fa',
    grants: ['authorization_code', 'refresh_token'],
    redirectUris: ['https://zapier.com/dashboard/auth/oauth/return/App229953CLIAPI/'],
  },
];

const tokens = [];
const codes = [];
const users = [{ id: 'user1', username: 'user1', password: 'password' }];

let lastSavedToken = null;

const model = {
  getClient: async (clientId, clientSecret) => {
    console.log('getClient ->', { clientId, clientSecret });
    const client = clients.find(
      (c) => c.clientId === clientId && (!clientSecret || c.clientSecret === clientSecret)
    );
    return client || null;
  },
  saveAuthorizationCode: async (code, client, user) => {
    const stored = {
      authorizationCode: code.authorizationCode || code.code || code,
      expiresAt: code.expiresAt || code.expirationDate || new Date(Date.now() + 600000),
      redirectUri: code.redirectUri || code.redirect_uri || '',
      client: client || code.client,
      user: user || code.user,
    };
    console.log('saveAuthorizationCode ->', stored);
    codes.push(stored);
    return stored;
  },
  getAuthorizationCode: async (authorizationCode) => {
    console.log('getAuthorizationCode ->', authorizationCode);
    return codes.find((c) => c.authorizationCode === authorizationCode) || null;
  },
  revokeAuthorizationCode: async (code) => {
    console.log('revokeAuthorizationCode ->', code);
    const idx = codes.findIndex((c) => c.authorizationCode === code.authorizationCode);
    if (idx !== -1) codes.splice(idx, 1);
    return true;
  },
  saveToken: async (token, client, user) => {
    const stored = {
      accessToken: token.accessToken || token.access_token,
      accessTokenExpiresAt:
        token.accessTokenExpiresAt ||
        (token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : new Date(Date.now() + 3600 * 1000)),
      refreshToken: token.refreshToken || token.refresh_token,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt || null,
      client: client || token.client,
      user: user || token.user,
    };
    console.log('saveToken ->', stored);
    tokens.push(stored);
    lastSavedToken = stored;
    return stored;
  },
  getAccessToken: async (accessToken) => {
    console.log('getAccessToken ->', accessToken);
    return tokens.find((t) => t.accessToken === accessToken || t.access_token === accessToken) || null;
  },
  getRefreshToken: async (refreshToken) => {
    console.log('getRefreshToken ->', refreshToken);
    return tokens.find((t) => t.refreshToken === refreshToken || t.refresh_token === refreshToken) || null;
  },
  revokeToken: async (token) => {
    console.log('revokeToken ->', token);
    const idx = tokens.findIndex((t) => t.refreshToken === token.refreshToken || t.refreshToken === token.refresh_token);
    if (idx !== -1) tokens.splice(idx, 1);
    return true;
  },
  verifyScope: async (token, scope) => {
    console.log('verifyScope ->', { token: token && (token.accessToken || token.access_token), scope });
    return true;
  },
  getUser: async (username, password) => {
    console.log('getUser ->', { username });
    const user = users.find((u) => u.username === username && u.password === password);
    return user || null;
  },
};

console.log('Model keys:', Object.keys(model));

let oauth;
try {
  oauth = new OAuth2Server({ model, allowBearerTokensInQueryString: true });
  console.log('OAuth2Server initialized');
} catch (err) {
  console.error('OAuth2Server init failed:', err);
  process.exit(1);
}

// GET /oauth/authorize
app.get('/oauth/authorize', (req, res) => {
  console.log('GET /oauth/authorize ->', req.query);
  if (!req.session.user) {
    return res.send(`
      <form method="POST" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${req.query.client_id || ''}">
        <input type="hidden" name="redirect_uri" value="${req.query.redirect_uri || ''}">
        <input type="hidden" name="state" value="${req.query.state || ''}">
        <input type="hidden" name="response_type" value="${req.query.response_type || 'code'}">
        <label>Username: <input type="text" name="username"></label>
        <label>Password: <input type="password" name="password"></label>
        <button type="submit">Login and Approve</button>
      </form>
    `);
  }

  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);

  // IMPORTANT: provide authenticateHandler so oauth2-server uses our session user
  oauth
    .authorize(request, response, {
      authenticateHandler: {
        handle: (reqInner) => {
          // returning the user object from session tells oauth2-server who the resource owner is
          return reqInner.session && reqInner.session.user ? reqInner.session.user : null;
        },
      },
    })
    .then((code) => {
      console.log('Authorization code generated:', code);
      const redirectUri = (code && code.redirectUri) || req.query.redirect_uri || req.query.redirectUri;
      const authorizationCode = (code && (code.authorizationCode || code.code)) || '';
      const state = req.query.state || '';
      res.redirect(`${redirectUri}?code=${authorizationCode}&state=${encodeURIComponent(state)}`);
    })
    .catch((err) => {
      console.error('Authorize error:', err);
      res.status(err.code || 400).json({ error: err.message || 'authorize_error' });
    });
});

// POST /oauth/authorize (login + approve)
app.post('/oauth/authorize', async (req, res) => {
  console.log('POST /oauth/authorize ->', { client_id: req.body.client_id, redirect_uri: req.body.redirect_uri, state: req.body.state });
  try {
    const user = await model.getUser(req.body.username, req.body.password);
    if (!user) return res.status(401).send('Invalid credentials');
    req.session.user = user;
    const safeQuery = new URLSearchParams({
      client_id: req.body.client_id || '',
      redirect_uri: req.body.redirect_uri || '',
      state: req.body.state || '',
      response_type: req.body.response_type || 'code',
    }).toString();
    res.redirect(`/oauth/authorize?${safeQuery}`);
  } catch (err) {
    console.error('POST /oauth/authorize error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /oauth/token (token exchange)
app.post('/oauth/token', (req, res) => {
  console.log('POST /oauth/token called — headers:', {
    'content-type': req.headers['content-type'],
    authorization: req.headers['authorization'],
  });
  console.log('POST /oauth/token body:', req.body);

  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);

  oauth
    .token(request, response)
    .then((token) => {
      const out = response.body || token || {};
      console.log('oauth.token returned ->', out);
      console.log('lastSavedToken (server-side) ->', lastSavedToken);

      const access_token = out.accessToken || out.access_token || (typeof out === 'string' ? out : undefined);
      const refresh_token = out.refreshToken || out.refresh_token;
      const expires_in = out.expires_in || (out.accessTokenExpiresAt ? Math.floor((new Date(out.accessTokenExpiresAt) - Date.now()) / 1000) : 3600);

      res.json({
        access_token: access_token,
        token_type: 'Bearer',
        expires_in: expires_in,
        refresh_token: refresh_token,
      });
    })
    .catch((err) => {
      console.error('Token error:', err);
      res.status(err.code || 400).json({ error: err.message || 'token_error' });
    });
});

// Debug endpoint
app.get('/debug/last-token', (req, res) => {
  res.json({ lastSavedToken });
});

// Protected endpoint /api/me
app.get('/api/me', (req, res) => {
  console.log('GET /api/me — Authorization header:', req.headers.authorization || '(none)');
  const request = new OAuth2Server.Request(req);
  const response = new OAuth2Server.Response(res);

  oauth
    .authenticate(request, response)
    .then((token) => {
      console.log('/api/me authenticated token:', token && (token.accessToken || token.access_token));
      res.json({ user_id: token.user.id, username: token.user.username, message: 'Authenticated' });
    })
    .catch((err) => {
      console.warn('/api/me auth failed:', err && err.message);
      res.status(401).json({ error: 'Unauthorized request: no authentication given or token invalid' });
    });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
