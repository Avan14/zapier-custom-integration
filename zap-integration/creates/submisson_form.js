// create a particular submisson-form by name
const perform = async (z, bundle) => {
  const response = await z.request({
    method: 'POST',
    url: 'https://7205df21d48d.ngrok-free.app/api/submissions',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${bundle.authData.access_token}`, // OAuth2 token
    },
    // if `body` is an object, it'll automatically get run through JSON.stringify
    // if you don't want to send JSON, pass a string in your chosen format here instead
    body: {
      name: bundle.inputData.name,
      email: bundle.inputData.email,
      message: bundle.inputData.message,
    }
  });
  // this should return a single object
  return response.data;
};

module.exports = {
  // see here for a full list of available properties:
  // https://github.com/zapier/zapier-platform/blob/main/packages/schema/docs/build/schema.md#createschema
  key: 'submisson_form',
  noun: 'Submisson',

  display: {
    label: 'Create Submission',
    description: 'Creates a new submission in your app, using data from a Google Form or other source.',
  },

  operation: {
    perform,

    // `inputFields` defines the fields a user could provide
    // Zapier will pass them in as `bundle.inputData` later. They're optional.
    // End-users will map data into these fields. In general, they should have any fields that the API can accept. Be sure to accurately mark which fields are required!
    inputFields: [
      {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: true,
        helpText: 'The name from the form submission.',
      },
      {
        key: 'email',
        label: 'Email',
        type: 'string',
        required: true,
        helpText: 'The email address from the form submission.',
      },
      {
        key: 'message',
        label: 'Message',
        type: 'text',
        required: false,
        helpText: 'Optional message or comments from the form.',
      },
    ],

    // In cases where Zapier needs to show an example record to the user, but we are unable to get a live example
    // from the API, Zapier will fallback to this hard-coded sample. It should reflect the data structure of
    // returned records, and have obvious placeholder values that we can show to any user.
    sample: {
      id: 'new-id-123',
      status: 'created',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test submission',
      },
    },

    // If fields are custom to each user (like spreadsheet columns), `outputFields` can create human labels
    // For a more complete example of using dynamic fields see
    // https://github.com/zapier/zapier-platform/tree/main/packages/cli#customdynamic-fields
    // Alternatively, a static field definition can be provided, to specify labels for the fields
    outputFields: [
      { key: 'id', label: 'Submission ID', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'data__name', label: 'Name', type: 'string' },
      { key: 'data__email', label: 'Email', type: 'string' },
    ]
  }
};
