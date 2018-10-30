const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');

const cors = require('cors')

const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

function formatDate(newDate){
  var day = days[newDate.getDay()];
  var month = months[newDate.getMonth()];
  var year = newDate.getFullYear();
  var dayNumber = newDate.getDate();
  return day + " " + month + " " + dayNumber + " " + year;
}

const mongoose = require('mongoose')
var Schema = mongoose.Schema;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

var userSchema = new Schema({
  _id: {
    'type': String,
    'default': shortid.generate
  },
  name: String,
  exercises: { type : Array , "default" : [] }
})

var User = mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// CREATE USER
app.post('/api/exercise/new-user', (req,res) => {
  
  var newUser = new User({
    name: req.body.username
  })
  
  // CHECK EXISTANCE
  User.find({name : req.body.username}, (err,result) => {
    if(result.length !== 0){
      res.send("Name already taken");
    } else {
      // SAVE USER       
      newUser.save( (err,data) => {
        if(err) { 
          console.log(err)
          res.json(err);
        }
        res.json({"username": data.name, "_id" : data._id});
      })
    }
  })
})

// FIND USER AND ADD EXERCISE
app.post('/api/exercise/add', (req,res) => {
    // Validation     
    if( !req.body.userId || !req.body.description || !req.body.duration ) {
      return res.send("Please fill in the required fields.");
    } else if (isNaN(Number(req.body.duration))){
      return res.send("Please enter a number for duration field");
    } else if (req.body.date && isNaN(Date.parse(req.body.date))) {
      return res.send("Please enter a YYYY-MM-DD formatted date");   
    } else if (!req.body.date){
      req.body.date = new Date(Date.now());
    }
  
    var newExercise = {
      description: req.body.description,
      duration: parseInt(req.body.duration),
      date: Date.parse(req.body.date)
    }
  
    User.findOneAndUpdate(
      {_id: req.body.userId},
      {$push: { exercises : newExercise }},
      {new:true}, 
      (err,data) => {
        if (err) console.log(err);
        if (data === null) {
          res.send("unknown _id");
        } else {
          res.json({
            username: data.name, 
            description: newExercise.description,
            duration: newExercise.duration, 
            _id: data._id, 
            date: formatDate(new Date(newExercise.date))
          })
        }  
    })
    
})

// USER LOG QUERY
app.get('/api/exercise/log', (req,res) => {
  var limit = Number(req.query.limit || 100);
  var from = Number(Date.parse(req.query.from) || 0);
  var to = Number(Date.parse(req.query.to) || Date.now());
  
  if (!req.query.user){
    return res.send("ID is required in the URL query string!");
  }

  // Match > Project > Filter > Slice
  User.aggregate([
    {$match : {_id : req.query.user}},
    {$project : {
      exercises: {
        $slice: [
          {
            $filter : {
              input : "$exercises",
              as: "exercise",
              cond: { $and: [
                { $gte: ['$$exercise.date', Math.min(from,to)] },
                { $lte: ['$$exercise.date', Math.max(from,to)] }
              ]}
            }} , limit ],
      }  
    }}
  ])
  .exec( (err,result) => {
    res.json(result)
  })
})



// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

