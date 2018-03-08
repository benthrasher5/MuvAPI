var path = require('path');
var ObjectID = require('mongodb').ObjectID;

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/Muv');
var schemas = {};
var schemaTemplates = require('./schemas').schemas;

const express = require('express');
var bodyParser = require('body-parser')
const app = express();
app.set('port', process.env.PORT || 3000);
app.use(bodyParser.json());

var db = mongoose.connection;
db.on('error', function () { console.log('error connecting to db') });
db.once('open', onConnect);

function onConnect() {
    setSchemas();

    setRoutes();

    startApiServer();
}

function setSchemas() {
  for (index in schemaTemplates) {
    var schemaTemplate = schemaTemplates[index];
    schemas[index] = mongoose.model(index, mongoose.Schema(schemaTemplate));
  }
}

function setRoutes() {
  app.get('/API/:collection', function (request, response) {
      var collection = request.params.collection;

      if(schemas[collection]) {
        schemas[collection].find(function (error, found) {
          if(error) response.status(400).send(error);
          else response.status(200).send(found);
        });
      } else {
        response.status(400).send({error: "Collection  '" + collection + "' not found."});
      }
  });

  app.get('/API/:collection/:id', function (request, response) {
    var collection = request.params.collection;
    var id = request.params.id;

    if(schemas[collection]) {
      schemas[collection].find({ "_id": ObjectID(id) }, function (error, found) {
        if(error) response.status(400).send(error);
        else response.status(200).send(found[0]);
      });
    } else {
      response.status(400).send({error: "Collection  '" + collection + "' not found."});
    }
  });

  app.post('/API/:collection/multiple', function (request, response) {
    var collection = request.params.collection;
    var ids = request.body.ids;

    if(schemas[collection]) {
      schemas[collection].find({ "_id": { $in: ids } }, function (error, found) {
        if(error) response.status(400).send(error);
        else response.status(200).send(found);
      });
    } else {
      response.status(400).send({error: "Collection  '" + collection + "' not found."});
    }
  });

  app.post('/API/:collection', function (request, response) {
    var collection = request.params.collection;
    var id = request.body._id;

    if(schemas[collection]) {
      if(id) {
        schemas[collection].findById(id, function (error, found) {
          if(error) insertNewDocument(request.body, collection, response);
          else { //update key vals
            for (key in schemaTemplates[collection]) {
              found[key] = request.body[key];
            }
            found.save(function (error, updated) {
              if (error) response.status(400).send(error);
              else response.status(200).send(updated);
            });
          }
        });
      } else {
        insertNewDocument(request.body, collection, response);
      }
    } else {
      response.send(400, {error: "Collection not found."});
    }
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/home.html'));
  });

  app.get('/headcount/:muvId', (request, response) => {
    var muvId = request.params.muvId;
    schemas['actions'].find({ "muvId": muvId }, function (error, found) {
      if(error) response.status(400).send(error);
      else response.send({ headcount: found.length.toString() });
    });
  });

  app.post('/login', function (request, response) {
    var username = request.body.username;
    var password = request.body.password;

    schemas["users"].find({username: username}, function (error, found) {
      if (error || !found ||  found.length == 0) response.status(400).send({error: "BAD_USER"});
      else {
        var user = found[0];
        if (user.password == password) {
          //generate session, pass back
          newSession(user._id, function (error, sessionString) {
            if (error) response.status(400).send({error: error});
            else {
              response.status(200).send({session: sessionString, userId: user._id});
            }
          });
        } else {
          response.status(400).send({error: "BAD_PASSWORD"});
        }
      }
    });
  });

  app.post('/session', function (request, response) {
    if(!request.body || !request.body.session || !schemas["sessions"]) {
      response.status(400).send({error: "error with request"});
    } else {
      schemas["sessions"].findById(request.body.session, function (error, found) {
        if (error || !found || found.length == 0) response.status(400).send({error: "error finding session"});
        else {
          response.status(200).send({});
        }
    });
    }
  });

  app.post('/logout', function (request, response) {
    var sessionId = request.body.session;
    if(sessionId) {
      schemas["sessions"].findOneAndRemove({ _id: sessionId}, function (error, rem) {
        if (error) response.status(400).send({error: "could not delete"});
        else {
          response.status(200).send({message: "removed session"});
        }
      });
    } else {
      response.status(400).send({error: "body does not contain session string"});
    }
  });

  app.use('/content', express.static('public'));

  //Catch-all, if no route match send this
  app.use(function (req, res) {
      res.status(400).send("<html><body><h1>Error: route was not found</h1></body></html>");
  });
}

function startApiServer() {
  app.listen(3000, () => console.log('Api server running on port ' + app.get('port')));
}

function insertNewDocument(doc, collection, responder) {
    var object = new schemas[collection](doc);
    object.save(function (error, obj) {
      if (error) responder.status(400).send(error);
      else responder.status(200).send(obj);
    });
}

function newSession(userId, callback) {
  schemas["sessions"].find({userId: userId}, function (error, found) {
    if(error || !found || found.length == 0) { //no existing session, create new one
      var session = new schemas["sessions"]({ userId: userId })
      session.save(function (error, obj) {
        if (error) callback("error saving new session", null);
        else {
          callback(null, obj._id);
        }
      });
    } else { //extisting session for user, error
      callback("user already logged in", null);
    }
  });
}