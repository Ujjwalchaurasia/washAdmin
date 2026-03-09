// server.js (FINAL COMPLETE CODE: All Features + Email Invoice)

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const nodemailer = require('nodemailer'); // NEW: Nodemailer Import
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: 'YOUR_VERY_STRONG_SECRET_KEY_HERE',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// --- 📧 EMAIL CONFIGURATION (Apna Email Yahan Dalein) ---
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: 'ujjwalchaurasia2004@gmail.com', 
    pass: 'aege tydk wjyl vrcb'     
  }
});

// --- Middleware Functions ---
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    if (req.session.role === 'user') {
      // User restrictions
      if (req.originalUrl.startsWith('/api/users') ||
          (req.originalUrl.startsWith('/api/bookings') && !req.originalUrl.includes('customer-bookings') && !req.originalUrl.includes('mark-paid') && !req.originalUrl.includes('cancel'))) {
        return res.status(403).json({ error: 'Forbidden: Restricted to admin/employee roles.' });
      }
      next();
    } else {
      // Admin/Employee allowed
      next();
    }
  } else {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Unauthorized access. Session expired or user not logged in.' });
    }
    res.redirect('/landing/index.html');
  }
}

function isAdmin(req, res, next) {
  if (req.session.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Only admin can perform this action.' });
  }
}

// --- Database Connection and Setup ---
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      customerName TEXT,
      customerPhone TEXT
    )`, (err) => {
      if (!err) {
        // Default Admin
        const defaultUsername = 'admin';
        const defaultPassword = 'adminpassword';
        db.get("SELECT * FROM users WHERE username = ?", [defaultUsername], (err, row) => {
          if (err) return;
          if (!row) {
            bcrypt.hash(defaultPassword, 10, (hashErr, hashedPassword) => {
              if (hashErr) return;
              db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                [defaultUsername, hashedPassword, 'admin']
              );
            });
          }
        });
      }
    });

    // 2. Bookings Table (With Customer Email)
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerUserId INTEGER,
      customerName TEXT,
      customerPhone TEXT,
      customerEmail TEXT,  -- ✅ New Column for Email
      vehicleType TEXT,
      vehicleNumber TEXT,
      vehicleModel TEXT,
      service TEXT,
      status TEXT DEFAULT 'Pending',
      price REAL,
      isPaid INTEGER DEFAULT 0,
      bookingDate TEXT DEFAULT (datetime('now', 'localtime'))
    )`, (err) => {
        // Migration Logic: Add customerEmail if table exists but column does not
        if (!err) {
             db.run("ALTER TABLE bookings ADD COLUMN customerEmail TEXT", (alterErr) => {
                 // Ignore error if column already exists
             });
        }
    });

    // 3. Services Table
    db.run(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      price REAL
    )`);
  }
});

app.use(express.static(path.join(__dirname)));
app.use('/landing', express.static(path.join(__dirname, 'landing')));

// --- 📄 HELPER: Generate PDF Buffer (For Email & Download) ---
// Ye function PDF banata hai aur usse Buffer ki tarah return karta hai
function generateInvoicePDF(booking) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });

        // PDF Layout Design
        doc.fontSize(25).text('WashAdmin Car Spa Invoice', { align: 'center' }).moveDown();
        doc.fontSize(14).text(`Invoice ID: INV-${booking.id}`, { continued: true }).text(`Date: ${booking.bookingDate}`, { align: 'right' });
        doc.fontSize(12).text(`Customer: ${booking.customerName}`);
        doc.text(`Phone: ${booking.customerPhone}`);
        
        if(booking.customerEmail) {
            doc.text(`Email: ${booking.customerEmail}`);
        }
        
        doc.moveDown();

        doc.fontSize(16).text('Service Details:', { underline: true }).moveDown(0.5);
        doc.fontSize(12);

        const tableTop = doc.y;
        const itemX = 50;
        const priceX = 450;
        
        doc.font('Helvetica-Bold').text('Service / Vehicle', itemX, tableTop);
        doc.text('Amount (INR)', priceX, tableTop, { align: 'right' });
        doc.moveDown(0.5).rect(itemX - 5, tableTop + 18, 500, 0.5).fillColor('black').fill();
        doc.font('Helvetica');

        const dataY = tableTop + 30;
        doc.text(`${booking.service} - ${booking.vehicleType} (${booking.vehicleNumber})`, itemX, dataY);
        doc.text(`${parseFloat(booking.price).toFixed(2)}`, priceX, dataY, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(14).text('Total Paid:', 300, doc.y, { continued: true }).text(`Rs. ${parseFloat(booking.price).toFixed(2)}`, { align: 'right' });
        doc.moveDown();
        
        // Payment Confirmation Stamp
        doc.fontSize(10).fillColor('green').text(`PAYMENT COMPLETED & VERIFIED`, { align: 'center' });
        doc.fontSize(10).fillColor('black').text(`Thank you for choosing WashAdmin!`, { align: 'center' });

        doc.end();
    });
}


// --- API Routes ---

// 1. Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    if (user.role === 'user') {
      return res.status(403).json({ error: 'This login is for Staff/Admin only. Please use Customer Login.' });
    }
    bcrypt.compare(password, user.password, (compareErr, result) => {
      if (compareErr) return res.status(500).json({ error: 'Authentication error.' });
      if (result) {
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.username = user.username;
        res.json({ message: 'Login successful', role: user.role });
      } else {
        res.status(401).json({ error: 'Invalid username or password.' });
      }
    });
  });
});

// 2. Forgot Password API
app.post('/api/user-forgot-password', async (req, res) => {
    const { username, customerPhone, newPassword } = req.body;
    if (!username || !customerPhone || !newPassword) {
        return res.status(400).json({ error: 'Username, phone number, and new password are required.' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            db.get("SELECT id, role, customerPhone FROM users WHERE username = ? AND role = 'user'", [username], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ error: 'Customer account not found.' });
        if (user.customerPhone !== customerPhone) return res.status(401).json({ error: 'Details do not match.' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id], function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Failed to update password.' });
            res.json({ message: 'Password reset successfully. Please log in with your new password.' });
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// 3. User Signup
app.post('/api/user-signup', (req, res) => {
  const { username, password, customerName, customerPhone } = req.body;
  if (!username || !password || !customerName || !customerPhone) {
    return res.status(400).json({ error: 'All fields (Username, Password, Name, Phone) are required.' });
  }
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: 'Could not process password.' });
    db.run("INSERT INTO users (username, password, role, customerName, customerPhone) VALUES (?, ?, ?, ?, ?)",
      [username, hashedPassword, 'user', customerName, customerPhone],
      function (dbErr) {
        if (dbErr) {
          if (dbErr.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username already exists.' });
          }
          return res.status(500).json({ error: dbErr.message });
        }
        // Auto-login on successful signup
        req.session.userId = this.lastID;
        req.session.role = 'user';
        req.session.username = username;
        res.status(201).json({
          message: 'Account created successfully. You are now logged in.',
          role: 'user',
          customerName: customerName,
          customerPhone: customerPhone
        });
      }
    );
  });
});

// 4. User Login
app.post('/api/user-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    if (user.role !== 'user') {
      return res.status(403).json({ error: 'Access denied. Please use Staff Login or check credentials.' });
    }
    bcrypt.compare(password, user.password, (compareErr, result) => {
      if (compareErr) return res.status(500).json({ error: 'Authentication error.' });
      if (result) {
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.username = user.username;
        res.json({
          message: 'Login successful',
          role: user.role,
          customerName: user.customerName,
          customerPhone: user.customerPhone
        });
      } else {
        res.status(401).json({ error: 'Invalid username or password.' });
      }
    });
  });
});

// 5. Check Auth Status
app.get('/api/checkAuth', (req, res) => {
  if (req.session.userId) {
    db.get("SELECT id, role, customerName, customerPhone FROM users WHERE id = ?", [req.session.userId], (err, user) => {
      if (err || !user) {
        return res.json({ isAuthenticated: false });
      }
      res.json({
        isAuthenticated: true,
        role: user.role,
        userId: user.id,
        customerName: user.customerName,
        customerPhone: user.customerPhone
      });
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// 6. Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not log out.' });
    res.json({ message: 'Logout successful' });
  });
});

// --- Admin: User Management API ---
app.post('/api/users', isAuthenticated, isAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'All fields required.' });
  if (role !== 'admin' && role !== 'employee') return res.status(400).json({ error: 'Invalid role.' });
  
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: 'Processing error.' });
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashedPassword, role],
      function (dbErr) {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        res.status(201).json({ message: 'User created.', userId: this.lastID, role: role });
      }
    );
  });
});

app.get('/api/users', isAuthenticated, isAdmin, (req, res) => {
  db.all("SELECT id, username, role FROM users WHERE role != 'user' ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id', isAuthenticated, isAdmin, (req, res) => {
  db.get("SELECT id, username, role FROM users WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found.' });
    res.json(row);
  });
});

app.put('/api/users/:id', isAuthenticated, isAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (password) {
    bcrypt.hash(password, 10, (err, hash) => {
      db.run("UPDATE users SET username=?, role=?, password=? WHERE id=?", [username, role, hash, req.params.id], function(err){
         if(err) return res.status(500).json({error: err.message});
         res.json({message: 'User updated'});
      });
    });
  } else {
     db.run("UPDATE users SET username=?, role=? WHERE id=?", [username, role, req.params.id], function(err){
         if(err) return res.status(500).json({error: err.message});
         res.json({message: 'User updated'});
      });
  }
});

app.delete('/api/users/:id', isAuthenticated, isAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User deleted.' });
  });
});


// --- PUBLIC BOOKING (UPDATED: Now Accepts Email) ---
app.post('/api/public-bookings', (req, res) => {
  const { customerName, customerPhone, customerEmail, vehicleType, vehicleNumber, vehicleModel, service } = req.body;
  const customerUserId = req.session.role === 'user' ? req.session.userId : null;
  
  if (!customerName || !customerPhone || !vehicleType || !vehicleNumber || !service) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }
  
  db.get("SELECT price FROM services WHERE name = ?", [service], (err, serviceRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const price = serviceRow ? serviceRow.price : 0.00;
    
    // ✅ Database Insert ab customerEmail bhi include karega
    db.run(`INSERT INTO bookings (customerUserId, customerName, customerPhone, customerEmail, vehicleType, vehicleNumber, vehicleModel, service, status, price, isPaid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 0)`,
      [customerUserId, customerName, customerPhone, customerEmail, vehicleType, vehicleNumber, vehicleModel, service, price],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({
          message: 'Booking added successfully.',
          id: this.lastID,
          acknowledgement: `Booking (ID: ${this.lastID}) Created. Invoice will be emailed upon payment.`
        });
      }
    );
  });
});

// Get Customer Bookings
app.get('/api/customer-bookings', isAuthenticated, (req, res) => {
  if (req.session.role !== 'user') return res.status(403).json({ error: 'Access denied.' });
  db.all(`SELECT * FROM bookings WHERE customerUserId = ? ORDER BY bookingDate DESC`, [req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Cancel Booking API
app.delete('/api/customer-bookings/cancel/:id', isAuthenticated, (req, res) => {
    if (req.session.role !== 'user') return res.status(403).json({ error: 'Forbidden' });
    db.run("UPDATE bookings SET status = 'Cancelled' WHERE id = ? AND customerUserId = ? AND status = 'Pending' AND isPaid = 0", 
    [req.params.id, req.session.userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Cannot cancel this booking.' });
        res.json({ message: 'Booking cancelled.' });
    });
});


// --- MARK PAID & SEND EMAIL (NEW FEATURE LOGIC) ---
app.put('/api/bookings/mark-paid/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  
  // 1. Update Status in Database
  const sql = `
    UPDATE bookings 
    SET isPaid = 1, status = 'Completed' 
    WHERE id = ? AND (status = 'Completed' OR status = 'Ready for Payment') AND isPaid = 0
  `; 
  
  db.run(sql, [id], function (dbErr) {
    if (dbErr) return res.status(500).json({ error: dbErr.message });
    if (this.changes === 0) {
        return res.status(400).json({ error: 'Booking not found, not ready for payment, or already paid.' });
    }

    // 2. Fetch Booking Details to send Email
    db.get("SELECT * FROM bookings WHERE id = ?", [id], async (err, booking) => {
        if(err || !booking) return res.json({ message: 'Payment Confirmed (Email Details Fetch Failed).' });
        
        // Check if customer provided an email
        if (booking.customerEmail) {
            try {
                // 3. Generate PDF Buffer
                const pdfBuffer = await generateInvoicePDF(booking);

                // 4. Configure Email
                const mailOptions = {
                    from: '"WashAdmin" <your-email@gmail.com>', // 🔴 Check your config at top
                    to: booking.customerEmail,
                    subject: `Payment Receipt - Booking #${booking.id}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333;">
                            <h2 style="color: #2ecc71;">Payment Received!</h2>
                            <p>Dear <strong>${booking.customerName}</strong>,</p>
                            <p>We have received your payment of <strong>Rs. ${parseFloat(booking.price).toFixed(2)}</strong> for the ${booking.service}.</p>
                            <p>Please find your official invoice attached to this email.</p>
                            <br>
                            <p>Thank you,<br><strong>WashAdmin Car Spa Team</strong></p>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: `Invoice_${booking.id}.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                };

                // 5. Send Email
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Email Error:', error);
                        return res.json({ message: 'Payment Success! (Email could not be sent)' }); 
                    }
                    console.log('Invoice Email sent: ' + info.response);
                    res.json({ message: 'Payment Success! Invoice has been emailed to the customer.' });
                });

            } catch (pdfError) {
                console.error('PDF Gen Error:', pdfError);
                res.json({ message: 'Payment Success! (PDF Generation Failed)' });
            }
        } else {
            res.json({ message: 'Payment Success! (No email address on file for invoice)' });
        }
    });
  });
});

// --- Update Booking (Admin) ---
app.put('/api/bookings', isAuthenticated, (req, res) => {
  const { customerName, customerPhone, vehicleType, vehicleNumber, vehicleModel, service, status, id, isPaid } = req.body; 
  // ... (Keep existing detailed validation/update logic logic)
  if (!id) return res.status(400).json({ error: 'ID Missing' });

  db.get("SELECT isPaid FROM bookings WHERE id=?", [id], (err, row) => {
      if(row && row.isPaid == 1 && status === 'Cancelled') return res.status(400).json({error: 'Cannot cancel paid booking'});
      
      db.get("SELECT price FROM services WHERE name=?", [service], (err, sRow) => {
          const price = sRow ? sRow.price : 0;
          const sql = `UPDATE bookings SET customerName=?, customerPhone=?, vehicleType=?, vehicleNumber=?, vehicleModel=?, service=?, status=?, price=?, isPaid=? WHERE id=?`;
          db.run(sql, [customerName, customerPhone, vehicleType, vehicleNumber, vehicleModel, service, status, price, isPaid||0, id], function(err){
             if(err) return res.status(500).json({error: err.message});
             res.json({message: 'Booking updated.'});
          });
      });
  });
});

// --- GET All Bookings ---
app.get('/api/bookings', isAuthenticated, (req, res) => {
  db.all("SELECT * FROM bookings ORDER BY bookingDate DESC", [], (err, rows) => res.json(rows));
});

app.get('/api/bookings/:id', isAuthenticated, (req, res) => {
    db.get("SELECT * FROM bookings WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});

app.delete('/api/bookings/:id', isAuthenticated, (req, res) => {
  db.run("DELETE FROM bookings WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted' });
  });
});

// --- Services ---
app.post('/api/services', isAuthenticated, isAdmin, (req, res) => {
  db.run("INSERT INTO services (name, price) VALUES (?, ?)", [req.body.name, req.body.price], function(err){
      if(err) return res.status(500).json({error: err.message});
      res.status(201).json({message: 'Added'});
  });
});
app.get('/api/services', (req, res) => db.all("SELECT * FROM services", [], (err, rows) => res.json(rows || [])));
app.delete('/api/services/:id', isAuthenticated, isAdmin, (req, res) => {
  db.run("DELETE FROM services WHERE id=?", [req.params.id], (err) => res.json({message: 'Deleted'}));
});

// --- Customers Data ---
app.get('/api/customers', isAuthenticated, (req, res) => {
  db.all(`SELECT customerName, COUNT(*) as totalBookings FROM bookings GROUP BY customerName ORDER BY totalBookings DESC`, [], (err, rows) => res.json(rows));
});

// --- Dashboard & Reports ---
app.get('/api/dashboard', isAuthenticated, async (req, res) => {
  // Simplified Promise logic for cleaner code block, functionality identical
  try {
      const rev = await new Promise(r => db.get("SELECT SUM(price) as t FROM bookings WHERE isPaid=1", (e,row)=>r(row.t||0)));
      const count = await new Promise(r => db.get("SELECT COUNT(*) as t FROM bookings", (e,row)=>r(row.t||0)));
      const stats = await new Promise(r => db.all("SELECT service, COUNT(service) as count FROM bookings GROUP BY service", (e,rows)=>r(rows)));
      res.json({ totalRevenue: rev, totalBookings: count, serviceStats: stats });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/reports/summary', isAuthenticated, (req, res) => {
    // Logic for Daily/Weekly/Monthly charts
    const { period } = req.query;
    let groupBy = "STRFTIME('%Y-%m', bookingDate)"; // Default monthly
    let filter = "DATE(bookingDate) >= DATE('now', '-365 days')";
    
    if(period === 'daily') { groupBy = "DATE(bookingDate)"; filter = "DATE(bookingDate) >= DATE('now', '-7 days')"; }
    else if(period === 'weekly') { groupBy = "STRFTIME('%Y-%W', bookingDate)"; filter = "DATE(bookingDate) >= DATE('now', '-56 days')"; }

    const sql = `SELECT ${groupBy} AS Period, COUNT(id) AS TotalBookings, SUM(CASE WHEN isPaid=1 THEN price ELSE 0 END) AS TotalRevenue FROM bookings WHERE ${filter} GROUP BY Period ORDER BY Period`;
    db.all(sql, [], (err, rows) => res.json(rows));
});

// --- Manual PDF Download (Reuse Helper) ---
app.get('/api/export/invoice/:id', isAuthenticated, (req, res) => {
    db.get("SELECT * FROM bookings WHERE id = ? AND isPaid = 1", [req.params.id], async (err, booking) => {
        if (err || !booking) return res.status(404).json({ error: 'Invoice not found' });
        
        const pdfBuffer = await generateInvoicePDF(booking);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice_${booking.id}.pdf"`);
        res.send(pdfBuffer);
    });
});


// --- Serve HTML ---
app.get('/', (req, res) => {
  if (req.session.userId) {
    if (req.session.role === 'user') res.sendFile(path.join(__dirname, 'publicBooking.html'));
    else res.sendFile(path.join(__dirname, 'dashboard.html'));
  } else res.sendFile(path.join(__dirname, 'landing', 'index.html'));
});

// Public Paths Logic
app.use((req, res, next) => {
  const publicPaths = ['/login.html', '/style.css', '/script.js', '/publicBooking.html', '/publicScript.js', '/landing'];
  const isPublic = publicPaths.some(p => req.path.startsWith(p) || req.path === '/');
  const isApi = req.path.startsWith('/api');
  
  if (req.session.userId || isPublic || isApi) next();
  else {
    if (!req.path.includes('.')) res.redirect('/landing/index.html');
    else next();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});