const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const db = new Database(path.join(__dirname, 'blog.db'));
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'replace-with-a-strong-secret',
    resave: false,
    saveUninitialized: false,
  })
);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('provider', 'customer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
  `);
}

initDb();

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    if (req.session.user.role !== role) {
      return res.status(403).render('error', {
        message: `Access denied. This page is only for ${role}s.`,
      });
    }

    return next();
  };
}

function truncateText(content, maxChars = 220) {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}...`;
}

app.get('/', (req, res) => {
  const blogs = db
    .prepare(
      `SELECT blogs.id, blogs.title, blogs.content, blogs.created_at, users.name AS author_name
       FROM blogs
       JOIN users ON users.id = blogs.author_id
       ORDER BY blogs.created_at DESC`
    )
    .all();

  const canReadFull = req.session.user && req.session.user.role === 'customer';

  const formattedBlogs = blogs.map((blog) => ({
    ...blog,
    displayContent: canReadFull ? blog.content : truncateText(blog.content),
    isTruncated: !canReadFull && blog.content.length > 220,
  }));

  res.render('index', { blogs: formattedBlogs, canReadFull });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).render('register', { error: 'All fields are required.' });
  }

  if (!['provider', 'customer'].includes(role)) {
    return res.status(400).render('register', { error: 'Invalid role selected.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).render('register', { error: 'Email already registered.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const insert = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  insert.run(name, email, passwordHash, role);

  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const user = db
    .prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?')
    .get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('login', { error: 'Invalid email or password.' });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return res.redirect('/');
});

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/blogs/new', requireRole('provider'), (req, res) => {
  res.render('new-blog', { error: null });
});

app.post('/blogs', requireRole('provider'), (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).render('new-blog', {
      error: 'Title and content are required.',
    });
  }

  db.prepare('INSERT INTO blogs (title, content, author_id) VALUES (?, ?, ?)').run(
    title,
    content,
    req.session.user.id
  );

  return res.redirect('/');
});

app.get('/blogs/:id', (req, res) => {
  const blog = db
    .prepare(
      `SELECT blogs.id, blogs.title, blogs.content, blogs.created_at, users.name AS author_name
       FROM blogs
       JOIN users ON users.id = blogs.author_id
       WHERE blogs.id = ?`
    )
    .get(req.params.id);

  if (!blog) {
    return res.status(404).render('error', { message: 'Blog not found.' });
  }

  const canReadFull = req.session.user && req.session.user.role === 'customer';

  res.render('blog-detail', {
    blog,
    canReadFull,
    preview: truncateText(blog.content),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
