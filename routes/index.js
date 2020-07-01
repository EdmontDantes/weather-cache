const express = require('express');
const router = express.Router();
// bring needed packages
const axios = require('axios');
const redis = require('redis');
require('dotenv').config();


// bring momentjs

//specify client redis
const client = redis.createClient(process.env.REDIS_PORT);

//bring momentjs to convert unix time stamp

const moment = require('moment');

//declare time variable 
const timeToCacheForInHours = 5;

//declare null location lat and long to be used after post request by zipcode
let locationLat;
let locationLng;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
}); 

const checkForData = async (req, res, next) => {
  try {
    await client.get('redisWeatherData', async (err, info) => {
      if (err) {
        return next(err);
      } else if (info === null) {
        console.log('null call');
        return next();
      }

      const currentDate = await Date.now();
      const parsedData = await JSON.parse(info);
      const redisDate = parsedData.date;

      if(Number(currentDate) < Number(redisDate) + timeToCacheForInHours * 1000 * 60 * 60) {
        console.log({parsedData: parsedData})
        let {data :{date, currently: {time: currTime, summary: currSummary, icon: currIcon, temperature: currTemp}, daily: {summary: weeklySummary, icon: weeklyIcon, data } }} = parsedData;
        res.render('index', { message: 'Cached Data', date, currTime, currSummary, currIcon, currTemp, weeklySummary, weeklyIcon, data, moment });
        // return res.json({ message: 'from Redis Cache', data: parsedData });
      }

      next();
    })
  } catch (err) {
    next(err);
  }
}
router.post('/weather/zipcode-query', async (req, res, next) => {
  try {
    let geoCodeQueryZip;
    geoCodeQueryZip = req.body.zipcode;
    if(geoCodeQueryZip) {

    const geoCodeIoToBeUsedForGeoCodingZipCode = `https://api.geocod.io/v1.6/geocode?q=${geoCodeQueryZip}&api_key=${process.env.GEOCOD_IO_API_KEY}`
    const resultGeoData = await axios.get(geoCodeIoToBeUsedForGeoCodingZipCode);
    console.log(resultGeoData.data);
    locationLat = resultGeoData.data.results[0].location.lat;
    locationLng = resultGeoData.data.results[0].location.lng;
    console.log(locationLat, locationLng)
    res.redirect('/weather')
    // res.json({message: 'your lat lng', locationLat, locationLng})
    } else {
      res.redirect('/weather')
    }
  } catch (err) {
    next(err)
  }
})

// router.get('/weather', (req, res, next) => {
//   res.render('index');
// })

router.get('/weather', checkForData, async (req, res, next) => {
  try {


      if(locationLat && locationLng) {
      const darkSkyUrl = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API_KEY}/${locationLat},${locationLng}?exclude=minutely,hourly,alerts,flags?lang=en?units=us`
      const currentDate = await Date.now();
      const result = await axios.get(darkSkyUrl);
      const weatherData = result.data;
      
      let newWeatherData = {};
      newWeatherData.date = currentDate;
      newWeatherData.data = weatherData;
      
      await client.setex('redisWeatherData', (timeToCacheForInHours * 60 * 60), JSON.stringify(newWeatherData));
      
      let {data :{date, currently: {time: currTime, summary: currSummary, icon: currIcon, temperature: currTemp}, daily: {summary: weeklySummary, icon: weeklyIcon, data } }} = newWeatherData;
      res.render('index', { message: 'Pulled Fresh Data from API', date, currTime, currSummary, currIcon, currTemp, weeklySummary, weeklyIcon, data, moment });
      // res.json({message: 'from api straight pull', newWeatherData });
      } else {
        res.render('index', {message: 'No Data was Pulled' })
      }

    
  } catch (err) {
    next(err);
  }
});



module.exports = router;
