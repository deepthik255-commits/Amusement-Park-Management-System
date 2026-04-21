const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');

// --- SOCKET.IO SETUP ---
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ────────────────────────────────
// 1. DATABASE CONNECTION
// ────────────────────────────────
mongoose.connect('mongodb://localhost:27017/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ────────────────────────────────
// 2. MODELS
// ────────────────────────────────
const User = mongoose.model('User', new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  password: String,
}));

const Admin = mongoose.model('Admin', new mongoose.Schema({
  username: String,
  password: String // hashed
}));

const Booking = mongoose.model('Booking', new mongoose.Schema({
  date: { type: String, required: true },
  timing: { type: String, required: true },
  type: { type: String, required: true },
  kids: { type: Number, required: true },
  adults: { type: Number, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  total: { type: Number, required: true },
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String }
}));

const rideSchema = new mongoose.Schema({
  rideId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true }
});
const RideState = mongoose.model('RideState', rideSchema);

// ────────────────────────────────
// 3. MIDDLEWARE
// ────────────────────────────────
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true,
}));

// ────────────────────────────────
// 4. CREATE DEFAULT ADMIN (once)
// ────────────────────────────────
async function createAdminIfNotExists() {
  const existingAdmin = await Admin.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminPassword123', 10);
    const admin = new Admin({ username: 'admin', password: hashedPassword });
    await admin.save();
    console.log('🛠️ Default admin created');
  }
}
createAdminIfNotExists();


// ────────────────────────────────
// 5. USER AUTH ROUTES
// ────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { fullname, email, password, confirmPassword } = req.body;

  if (!fullname || !email || !password || !confirmPassword)
    return res.send('All fields are required.');

  if (password !== confirmPassword)
    return res.send('Passwords do not match.');

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.send('User already exists!');

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fullname, email, password: hashedPassword });
    await newUser.save();

    res.redirect('/login.html');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Server error during registration');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.send('All fields are required.');

  try {
    const user = await User.findOne({ email });
    if (!user) return res.send('Invalid email or password.');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.send('Invalid email or password.');

    req.session.user = { id: user._id, email: user.email };
    res.redirect('/index2.html');
  } catch (err) {
    console.error('User login error:', err);
    res.status(500).send('Server error');
  }
});

app.get('/dashboard.html', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.status(401).send('Unauthorized. Please log in.');
  }
});

// ────────────────────────────────
// 6. ADMIN ROUTES
// ────────────────────────────────
app.post('/admin-dashboard', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.send('All fields are required.');

  try {
       const admin = await Admin.findOne({ username });
       if (!admin) return res.send('Invalid username or password.');

       const isMatch = await bcrypt.compare(password, admin.password);
       if (!isMatch) return res.send('Invalid username or password.');



    req.session.admin = { id: admin._id, username: admin.username };
    res.redirect('/adminusers.html');
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).send('Server error');
  }
});

app.get('/adminusers.html', (req, res) => {
  if (req.session.admin) {
    res.sendFile(path.join(__dirname, 'public', 'adminusers.html'));
  } else {
    res.status(401).send('Unauthorized. Please log in as admin.');
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Server error');
  }
});

// ────────────────────────────────
// 7. TICKET BOOKING ROUTES
// ────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

app.get('/api/bookings/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const bookings = await Booking.find({ email: { $regex: new RegExp('^' + email + '$', 'i') } });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/bookings/:id/rating
app.post('/api/bookings/:id/rating', async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1-5" });
  }
  try {
    const booking = await Booking.findByIdAndUpdate(id, { rating }, { new: true });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: "Failed to save rating" });
  }
});

// POST /api/bookings/:id/rating - Store both rating and feedback
app.post('/api/bookings/:id/rating', async (req, res) => {
  const { id } = req.params;
  const { rating, feedback } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1-5" });
  }
  if (!feedback) {
    return res.status(400).json({ error: "Feedback is required" });
  }
  try {
    const booking = await Booking.findByIdAndUpdate(
      id,
      { rating, feedback },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: "Failed to save rating" });
  }
});

// ────────────────────────────────
// 8. RIDE STATE ROUTES (WITH SOCKET.IO)
// ────────────────────────────────

// GET all ride states
app.get('/api/rides-state', async (req, res) => {
  const states = await RideState.find({});
  const result = {};
  states.forEach(r => result[r.rideId] = r.enabled);
  res.json(result);
});

// POST: Set ride enabled/disabled
app.post('/api/rides-state', async (req, res) => {
  const { rideId, enabled } = req.body;
  if (!rideId || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid input' });

  await RideState.findOneAndUpdate(
    { rideId },
    { enabled },
    { upsert: true, new: true }
  );
  // --- Real-time update: emit to all clients ---
  io.emit('rideStateChanged', { rideId, enabled });
  res.json({ success: true });
});

//restaurant.html
const restaurantSchema = new mongoose.Schema({
  _id: String, // kebab-case restaurant id, e.g. "park-view-cafe"
  status: { type: String, enum: ['open', 'closed'], default: 'open' }
});
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// GET all restaurants with status
app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// ADMIN: Update restaurant status
app.post('/api/restaurants/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { status },
      { new: true, upsert: true }
    );
    // Optionally emit real-time update
    io.emit('restaurantStatusChanged', { id, status });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

//admintickets.html
// GET all bookings (admin or for all bookings page)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ date: -1 }); // newest first
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// API endpoint to get monthly revenue
// API endpoint to get monthly revenue
app.get('/api/revenue-by-month', async (req, res) => {
  try {
    // Assumes Booking.date is in 'YYYY-MM-DD' or similar format
    const revenue = await Booking.aggregate([
      {
        $addFields: {
          dateObj: { $dateFromString: { dateString: "$date" } }
        }
      },
      {
        $group: {
          _id: { $month: "$dateObj" },
          total: { $sum: "$total" }
        }
      },
      {
        $project: {
          month: '$_id',
          total: 1,
          _id: 0
        }
      }
    ]);
    // Fill missing months with zero revenue
    const monthlyRevenue = Array(12).fill(0);
    revenue.forEach(r => {
      monthlyRevenue[r.month - 1] = r.total;
    });
    res.json(monthlyRevenue);
  } catch (err) {
    console.error('Revenue aggregation error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});


// API endpoint to get daily visitors (bookings per day)
app.get('/api/daily-visitors', async (req, res) => {
  try {
    const visitors = await Booking.aggregate([
      {
        $group: {
          _id: "$date", // group by date string
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } } // sort by date ascending
    ]);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily visitors data' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();

    // Emit updated summary to all connected clients
    const summary = await Booking.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalVisitors: { $sum: 1 }
        }
      }
    ]);
    io.emit('summaryUpdate', summary[0] || { totalRevenue: 0, totalVisitors: 0 });

    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

// ────────────────────────────────
// 9. LOGOUT ROUTE
// ────────────────────────────────
app.get('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Error logging out');
    res.redirect('/index.html');
  });
});

// ────────────────────────────────
// 10. START SERVER (WITH SOCKET.IO)
// ────────────────────────────────
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
