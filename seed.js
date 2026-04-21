const mongoose = require('mongoose');
const { Ride } = require('./server'); // Adjust to import models from your main server file

// Seed data
const rides = [
  {
    name: "Aqua Splash",
    description: "A thrilling water ride with twists and turns.",
    type: "Wet",
    thrillLevel: "High",
    ageGroup: "Teens",
    heightRestriction: "48 inches",
    timing: "10:00 AM - 6:00 PM",
    imageUrl: "https://example.com/images/aqua-splash.jpg",
  },
  {
    name: "Lazy River",
    description: "Relax and float gently along the lazy river.",
    type: "Wet",
    thrillLevel: "Low",
    ageGroup: "Kids",
    heightRestriction: "No restriction",
    timing: "9:00 AM - 5:00 PM",
    imageUrl: "https://example.com/images/lazy-river.jpg",
  },
  {
    name: "Roller Coaster",
    description: "High-speed ride with loops and steep drops.",
    type: "Dry",
    thrillLevel: "High",
    ageGroup: "Adults",
    heightRestriction: "54 inches",
    timing: "11:00 AM - 7:00 PM",
    imageUrl: "https://example.com/images/roller-coaster.jpg",
  },
  // Add more rides as necessary...
];

// Connect to MongoDB and seed data
async function seedData() {
  try {
    // Ensure mongoose connects first
    await mongoose.connect('mongodb://localhost:27017/amusement_park', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB for seeding');

    // Clean up existing rides
    await Ride.deleteMany({});
    console.log('❌ Cleared existing rides');

    // Insert the seed data
    await Ride.insertMany(rides);
    console.log("✅ Ride data seeded successfully!");

    // Disconnect from MongoDB after seeding
    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    mongoose.disconnect();
  }
}

// Execute the seeding function
seedData();
