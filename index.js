// Import modul yang diperlukan
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const session = require("express-session");
const multer = require("multer");
const xlsx = require("xlsx");

// Inisialisasi Express app
const app = express();

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Tambahkan session middleware
app.use(
  session({
    secret: "secret-key", // Ganti dengan secret key yang lebih aman
    resave: false,
    saveUninitialized: true,
  })
);

// MySQL Connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // Ubah dengan password MySQL Anda
  database: "minimarket", // Nama database yang ingin Anda gunakan
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: " + err.stack);
    return;
  }
  console.log("Connected to MySQL database");
});

// Route untuk halaman login
app.get("/", (req, res) => {
  res.render("login");
});

// Middleware untuk menghandle upload file
const upload = multer({ dest: "uploads/" });

// Proses upload file Excel
app.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No files were uploaded.");
  }

  const workbook = xlsx.readFile(req.file.path);
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

  const sql =
    "INSERT INTO produk (nama_produk, barcode, harga_beli, harga_jual, stok) VALUES ?";
  const values = data.map((row) => [
    row.nama_produk,
    row.barcode,
    row.harga_beli,
    row.harga_jual,
    row.stok,
  ]);

  connection.query(sql, [values], (err, result) => {
    if (err) throw err;
    console.log("Number of records inserted: " + result.affectedRows);
    res.redirect("/produk");
  });
});

// Proses upload file Excel
app.post("/import/pengguna", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No files were uploaded.");
  }

  const workbook = xlsx.readFile(req.file.path);
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

  const sql =
    "INSERT INTO pengguna (nama_pengguna, kata_sandi, peran) VALUES ?";
  const values = data.map((row) => [
    row.nama_pengguna,
    row.kata_sandi,
    row.peran,
  ]);

  connection.query(sql, [values], (err, result) => {
    if (err) throw err;
    console.log("Number of records inserted: " + result.affectedRows);
    res.redirect("/produk");
  });
});

// Route untuk proses login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  // Query ke database untuk memeriksa kredensial pengguna
  connection.query(
    "SELECT * FROM pengguna WHERE nama_pengguna = ? AND kata_sandi = ?",
    [username, password],
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        const user = results[0];
        req.session.user = { id: user.id_pengguna, role: user.peran };
        res.redirect("/dashboard");
      } else {
        res.redirect("/");
      }
    }
  );
});

// Middleware untuk memeriksa apakah pengguna sudah login
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  } else {
    res.redirect("/");
  }
};

// Route untuk mendapatkan data produk dari database berdasarkan barcode
app.get("/produk/:barcode", isLoggedIn, (req, res) => {
  const barcode = req.params.barcode;
  // Query untuk mendapatkan data produk berdasarkan barcode
  const query = `SELECT * FROM produk WHERE barcode = ?`;
  const values = [barcode];
  // Melakukan eksekusi query
  connection.query(query, values, (error, results, fields) => {
    if (error) {
      console.error("Gagal mendapatkan data produk:", error);
      return res.status(500).json({ message: "Gagal mendapatkan data produk" });
    }
    // Jika data produk ditemukan, kirim sebagai respons
    if (results.length > 0) {
      const produk = results[0];
      res.status(200).json(produk);
    } else {
      // Jika data produk tidak ditemukan
      res.status(404).json({ message: "Produk tidak ditemukan" });
    }
  });
});

// Route untuk menampilkan halaman daftar produk
app.get("/produk", isLoggedIn, (req, res) => {
  connection.query("SELECT * FROM produk", (err, results) => {
    if (err) throw err;
    res.render("produk/index", { produk: results });
  });
});

// Route untuk menampilkan halaman tambah produk
app.get("/add/produk", isLoggedIn, (req, res) => {
  res.render("produk/add");
});

// Route untuk menambahkan produk baru ke dalam database
app.post("/add/produk", isLoggedIn, (req, res) => {
  const { nama_produk, barcode, harga_beli, harga_jual, stok } = req.body;
  const sql =
    "INSERT INTO produk (nama_produk, barcode, harga_beli, harga_jual, stok) VALUES (?, ?, ?, ?, ?)";
  const values = [nama_produk, barcode, harga_beli, harga_jual, stok];
  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    console.log("Product added:", result);
    res.redirect("/produk");
  });
});

// Route untuk menampilkan halaman edit produk
app.get("/edit/produk/:id", isLoggedIn, (req, res) => {
  const productId = req.params.id;
  connection.query(
    "SELECT * FROM produk WHERE id_produk = ?",
    productId,
    (err, result) => {
      if (err) throw err;
      res.render("produk/edit", { produk: result[0] }); // Memperbaiki penamaan variabel product menjadi produk
    }
  );
});

// Route untuk menyimpan perubahan pada produk ke dalam database
app.post("/edit/produk/:id", isLoggedIn, (req, res) => {
  const productId = req.params.id;
  const { nama_produk, barcode, harga_beli, harga_jual, stok } = req.body;
  const sql =
    "UPDATE produk SET nama_produk = ?, barcode = ?, harga_beli = ?, harga_jual = ?, stok = ? WHERE id_produk = ?";
  const values = [nama_produk, barcode, harga_beli, harga_jual, stok, productId];
  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    console.log("Product updated:", result);
    res.redirect("/produk");
  });
});

// Route untuk menghapus produk dari database
app.get("/delete/produk/:id", isLoggedIn, (req, res) => {
  const productId = req.params.id;
  connection.query(
    "DELETE FROM produk WHERE id_produk = ?",
    productId,
    (err, result) => {
      if (err) throw err;
      console.log("Product deleted:", result);
      res.redirect("/produk");
    }
  );
});

// Route untuk menampilkan halaman daftar pengguna (hanya bisa diakses oleh admin)
app.get("/pengguna", isLoggedIn, (req, res) => {
  connection.query("SELECT * FROM pengguna", (err, results) => {
    if (err) throw err;
    res.render("pengguna/index", { pengguna: results });
  });
});

app.get("/add/pengguna", isLoggedIn, (req, res) => {
  res.render("pengguna/add");
});

// Route untuk menambahkan pengguna baru ke dalam database
app.post("/add/pengguna", isLoggedIn, (req, res) => {
  const { nama_pengguna, kata_sandi, peran, kode } = req.body;
  const sql =
    "INSERT INTO pengguna (nama_pengguna, kata_sandi, peran, kode) VALUES (?, ?, ?, ?)";
  const values = [nama_pengguna, kata_sandi, peran, kode];
  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    console.log("User added:", result);
    res.redirect("/pengguna");
  });
});

// Route untuk menampilkan halaman edit pengguna (hanya bisa diakses oleh admin)
app.get("/edit/pengguna/:id", isLoggedIn, (req, res) => {
  const userId = req.params.id;
  connection.query(
      "SELECT * FROM pengguna WHERE id_pengguna = ?",
      [userId], // Gabungkan userId ke dalam array
      (err, result) => {
          if (err) throw err;
          res.render("pengguna/edit", { pengguna: result[0] }); // Mengganti nama variabel user menjadi pengguna
      }
  );
});


// Route untuk menyimpan perubahan pada pengguna ke dalam database
app.post("/edit/pengguna/:id", isLoggedIn, (req, res) => {
  const userId = req.params.id;
  const { nama_pengguna, kata_sandi, peran, kode } = req.body;
  const sql =
    "UPDATE pengguna SET nama_pengguna = ?, kata_sandi = ?, peran = ?, kode = ? WHERE id_pengguna = ?";
  const values = [nama_pengguna, kata_sandi, peran, kode, userId];
  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    console.log("User updated:", result);
    res.redirect("/pengguna");
  });
});

// Route untuk menghapus pengguna dari database
app.get("/delete/pengguna/:id", isLoggedIn, (req, res) => {
  const userId = req.params.id;
  connection.query(
    "DELETE FROM pengguna WHERE id_pengguna = ?",
    userId,
    (err, result) => {
      if (err) throw err;
      console.log("User deleted:", result);
      res.redirect("/pengguna");
    }
  );
});

// Route untuk menampilkan dashboard
app.get("/dashboard", isLoggedIn, (req, res) => {
  if (req.session.user.role === "admin") {
    res.render("index");
  } else {
    res.redirect("/transaksi");
  }
});

// Route untuk menampilkan halaman transaksi
app.get("/transaksi", isLoggedIn, (req, res) => {
  if (req.session.user.role === "kasir") {
    const username = req.session.user.username;
    res.render("transaksi/index", { username: username });
  } else {
    res.redirect("/");
  }
});

// Server listening
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
