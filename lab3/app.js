const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "database", "books.db");

let db;

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: databasePath,
            driver: sqlite3.Database,
        });

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`Server running at port ${PORT}`);
        });
    } catch (error) {
        console.error(`Database connection failed: ${error.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

// GET all books with search, sorting, pagination and price filtering
app.get("/books", async (request, response) => {
    try {
        const {
            search_q,
            order_by,
            order,
            limit,
            offset,
            min_price,
            max_price
        } = request.query;

        let query = "SELECT * FROM book";
        let params = [];
        let conditions = [];

        // Search
        if (search_q) {
            conditions.push("title LIKE ?");
            params.push(`%${search_q}%`);
        }

        // Price filtering
        if (min_price !== undefined) {
            const minPrice = Number(min_price);

            if (!Number.isFinite(minPrice)) {
                return response.status(400).json({
                    message: "min_price must be a valid number"
                });
            }

            conditions.push("price >= ?");
            params.push(minPrice);
        }

        if (max_price !== undefined) {
            const maxPrice = Number(max_price);

            if (!Number.isFinite(maxPrice)) {
                return response.status(400).json({
                    message: "max_price must be a valid number"
                });
            }

            conditions.push("price <= ?");
            params.push(maxPrice);
        }

        if (
            min_price !== undefined &&
            max_price !== undefined &&
            Number(min_price) > Number(max_price)
        ) {
            return response.status(400).json({
                message: "min_price cannot be greater than max_price"
            });
        }

        // Apply filtering conditions
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Sorting
        const validColumns = ["id", "title", "author", "price", "pages"];

        const sortColumn = validColumns.includes(order_by)
            ? order_by
            : "id";

        const sortOrder =
            order && order.toUpperCase() === "DESC" ? "DESC" : "ASC";

        query += ` ORDER BY ${sortColumn} ${sortOrder}`;

        // Pagination
        const parsedLimit = Number.parseInt(limit ?? "10", 10);
        const parsedOffset = Number.parseInt(offset ?? "0", 10);

        const safeLimit =
            Number.isInteger(parsedLimit) && parsedLimit > 0
                ? parsedLimit
                : 10;

        const safeOffset =
            Number.isInteger(parsedOffset) && parsedOffset >= 0
                ? parsedOffset
                : 0;

        query += " LIMIT ? OFFSET ?";
        params.push(safeLimit, safeOffset);

        const books = await db.all(query, params);

        response.status(200).json(books);

    } catch (error) {
        response.status(500).json({
            message: "Failed to retrieve books"
        });
    }
});

// GET one book
app.get("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;
        const book = await db.get("SELECT * FROM book WHERE id = ?", bookId);

        if (!book) {
            return response.status(404).json({ message: "Book not found" });
        }

        response.status(200).json(book);
    } catch (error) {
        response.status(500).json({ message: "Failed to retrieve book" });
    }
});

// POST a book
app.post("/books", async (request, response) => {
    try {
        const { title, author, price, pages } = request.body;

        // Validate required fields
        if (
            !title ||
            !author ||
            price === undefined ||
            pages === undefined
        ) {
            return response.status(400).json({
                message: "Title, author, price, and pages are required"
            });
        }

        // Validate price
        if (typeof price !== "number" || !Number.isFinite(price)) {
            return response.status(400).json({
                message: "Price must be a valid number"
            });
        }

        const result = await db.run(
            "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
            title,
            author,
            price,
            pages
        );

        response.status(201).json({
            message: "Book added successfully",
            id: result.lastID,
            title,
            author,
            price,
            pages
        });

    } catch (error) {
        response.status(500).json({
            message: "Failed to add book"
        });
    }
});

// PUT a book
app.put("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;
        const { title, author, price, pages } = request.body;

        // Validate required fields
        if (
            !title ||
            !author ||
            price === undefined ||
            pages === undefined
        ) {
            return response.status(400).json({
                message: "Title, author, price, and pages are required"
            });
        }

        // Validate price
        if (typeof price !== "number" || !Number.isFinite(price)) {
            return response.status(400).json({
                message: "Price must be a valid number"
            });
        }

        const result = await db.run(
            "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
            title,
            author,
            price,
            pages,
            bookId
        );

        if (result.changes === 0) {
            return response.status(404).json({
                message: "Book not found"
            });
        }

        response.status(200).json({
            message: "Book updated successfully"
        });

    } catch (error) {
        response.status(500).json({
            message: "Failed to update book"
        });
    }
});

// DELETE a book
app.delete("/books/:bookId", async (request, response) => {
    try {
        const { bookId } = request.params;

        const result = await db.run("DELETE FROM book WHERE id = ?", bookId);

        if (result.changes === 0) {
            return response.status(404).json({ message: "Book not found" });
        }

        response.status(200).json({ message: "Book deleted successfully" });
    } catch (error) {
        response.status(500).json({ message: "Failed to delete book" });
    }
});

module.exports = app;