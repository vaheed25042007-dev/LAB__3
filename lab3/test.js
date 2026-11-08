const path = require("path");

process.env.PORT = process.env.PORT || "3000";

async function runTests() {
    const app = require("./app");

    // Wait for db and server initialization
    await new Promise((resolve) => setTimeout(resolve, 800));

    const baseUrl = `http://127.0.0.1:${process.env.PORT}`;
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`[PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`[FAIL] ${name}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n=== Running Lab 3 REST API Test Suite on Port ${process.env.PORT} ===\n`);

    await test("GET /books returns array of books", async () => {
        const res = await fetch(`${baseUrl}/books`);
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Expected array");
        if (data.length === 0) throw new Error("Expected non-empty array");
    });

    await test("GET /books?search_q=The filters by title", async () => {
        const res = await fetch(`${baseUrl}/books?search_q=The`);
        const data = await res.json();
        if (!data.every(b => b.title.toLowerCase().includes("the"))) {
            throw new Error("Books do not match search query");
        }
    });

    await test("GET /books?order_by=price&order=ASC sorts ascending", async () => {
        const res = await fetch(`${baseUrl}/books?order_by=price&order=ASC`);
        const data = await res.json();
        for (let i = 1; i < data.length; i++) {
            if (data[i].price < data[i - 1].price) throw new Error("Not sorted ascending");
        }
    });

    await test("GET /books?order_by=price&order=DESC sorts descending", async () => {
        const res = await fetch(`${baseUrl}/books?order_by=price&order=DESC`);
        const data = await res.json();
        for (let i = 1; i < data.length; i++) {
            if (data[i].price > data[i - 1].price) throw new Error("Not sorted descending");
        }
    });

    await test("GET /books?limit=3&offset=0 respects pagination", async () => {
        const res = await fetch(`${baseUrl}/books?limit=3&offset=0`);
        const data = await res.json();
        if (data.length !== 3) throw new Error(`Expected 3 books, got ${data.length}`);
    });

    await test("GET /books?min_price=250&max_price=400 filters price range", async () => {
        const res = await fetch(`${baseUrl}/books?min_price=250&max_price=400`);
        const data = await res.json();
        if (!data.every(b => b.price >= 250 && b.price <= 400)) {
            throw new Error("Price not in range");
        }
    });

    await test("GET /books?min_price=500&max_price=200 returns 400 Bad Request", async () => {
        const res = await fetch(`${baseUrl}/books?min_price=500&max_price=200`);
        if (res.status !== 400) throw new Error(`Expected status 400, got ${res.status}`);
    });

    await test("GET /books/1 returns single book by ID", async () => {
        const res = await fetch(`${baseUrl}/books/1`);
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (data.id !== 1) throw new Error(`Expected id 1, got ${data.id}`);
    });

    await test("GET /books/99999 returns 404 Not Found", async () => {
        const res = await fetch(`${baseUrl}/books/99999`);
        if (res.status !== 404) throw new Error(`Expected status 404, got ${res.status}`);
    });

    let newBookId;
    await test("POST /books creates new book with 201 Created", async () => {
        const res = await fetch(`${baseUrl}/books`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Test Book Clean Code",
                author: "Robert C. Martin",
                price: 450,
                pages: 464
            })
        });
        if (res.status !== 201) throw new Error(`Expected status 201, got ${res.status}`);
        const data = await res.json();
        if (!data.id) throw new Error("Expected returned id");
        newBookId = data.id;
    });

    await test("POST /books validation: missing title returns 400 Bad Request", async () => {
        const res = await fetch(`${baseUrl}/books`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                author: "Robert C. Martin",
                price: 450,
                pages: 464
            })
        });
        if (res.status !== 400) throw new Error(`Expected status 400, got ${res.status}`);
    });

    await test("POST /books validation: invalid price returns 400 Bad Request", async () => {
        const res = await fetch(`${baseUrl}/books`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Bad Price Book",
                author: "Author",
                price: "invalid_price",
                pages: 100
            })
        });
        if (res.status !== 400) throw new Error(`Expected status 400, got ${res.status}`);
    });

    await test("PUT /books/:id updates book successfully", async () => {
        const res = await fetch(`${baseUrl}/books/${newBookId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Test Book Clean Code 2nd Ed",
                author: "Robert C. Martin",
                price: 500,
                pages: 480
            })
        });
        if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
    });

    await test("PUT /books/99999 returns 404 Not Found", async () => {
        const res = await fetch(`${baseUrl}/books/99999`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Non-existent",
                author: "Ghost",
                price: 100,
                pages: 50
            })
        });
        if (res.status !== 404) throw new Error(`Expected status 404, got ${res.status}`);
    });

    await test("DELETE /books/:id deletes book", async () => {
        const res = await fetch(`${baseUrl}/books/${newBookId}`, {
            method: "DELETE"
        });
        if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
    });

    await test("DELETE /books/99999 returns 404 Not Found", async () => {
        const res = await fetch(`${baseUrl}/books/99999`, {
            method: "DELETE"
        });
        if (res.status !== 404) throw new Error(`Expected status 404, got ${res.status}`);
    });

    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
