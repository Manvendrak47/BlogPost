const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

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

function initDataStore() {
  if (!fs.existsSync(DATA_PATH)) {
    const initialData = {
      counters: { userId: 0, blogId: 0 },
      users: [],
      blogs: [],
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

initDataStore();

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

function listBlogsWithAuthors(data) {
  return data.blogs
    .map((blog) => {
      const author = data.users.find((user) => user.id === blog.author_id);
      return {
        ...blog,
        author_name: author ? author.name : 'Unknown',
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

app.get('/', (req, res) => {
  const data = readData();
  const blogs = listBlogsWithAuthors(data);
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

  const data = readData();
  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = data.users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    return res.status(400).render('register', { error: 'Email already registered.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  data.counters.userId += 1;

  data.users.push({
    id: data.counters.userId,
    name: String(name).trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    role,
    created_at: new Date().toISOString(),
  });

  writeData(data);
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = data.users.find((u) => u.email === normalizedEmail);

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

  const data = readData();
  data.counters.blogId += 1;

  data.blogs.push({
    id: data.counters.blogId,
    title: String(title).trim(),
    content: String(content).trim(),
    author_id: req.session.user.id,
    created_at: new Date().toISOString(),
  });

  writeData(data);
  return res.redirect('/');
});

app.get('/blogs/:id', (req, res) => {
  const data = readData();
  const blogId = Number(req.params.id);
  const blog = listBlogsWithAuthors(data).find((entry) => entry.id === blogId);

  if (!blog) {
    return res.status(404).render('error', { message: 'Blog not found.' });
  }

  const canReadFull = req.session.user && req.session.user.role === 'customer';

  return res.render('blog-detail', {
    blog,
    canReadFull,
    preview: truncateText(blog.content),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
