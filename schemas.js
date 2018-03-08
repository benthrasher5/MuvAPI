exports.schemas = {
  "users": {
    username: String,
    password: String,
    name: {
      first: String,
      last: String
    },
    photoURL: String,
    settingsId: String
  },

  "sessions": {
    sessionString: String,
    userId: String
  },

  "muvs": {
    name: String,
    description: String,
    specialText: String,
    imageFolderURL: String,
    location: String
  },

  "actions": {
    userId: String,
    muvId: String,
    datetime: String,
  }
};