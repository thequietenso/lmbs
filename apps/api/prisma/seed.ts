import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function main() {
  const genreNames = [
    "Computer Science",
    "Software Engineering",
    "Science Fiction",
    "Design & UX",
    "History",
    "Self Improvement",
    "Productivity",
    "Philosophy",
    "Mathematics",
    "Literature",
  ];

  const genres = await Promise.all(
    genreNames.map((name) =>
      prisma.genre.upsert({
        where: { name },
        update: {},
        create: {
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
          description: `${name} — foundational readings and core texts.`,
        },
      }),
    ),
  );

  const genreMap = new Map(genres.map((g) => [g.name, g]));

  const sampleBooks = [
    {
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      genre: "Computer Science",
      pages: 616,
      publishedYear: 2017,
      description: "The definitive guide to distributed systems.",
      coverGradient: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
    },
    {
      title: "Clean Code",
      author: "Robert C. Martin",
      genre: "Software Engineering",
      pages: 464,
      publishedYear: 2008,
      description: "Master clean code craftsmanship.",
      coverGradient: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)",
    },
    {
      title: "The Pragmatic Programmer",
      author: "David Thomas & Andrew Hunt",
      genre: "Software Engineering",
      pages: 352,
      publishedYear: 2019,
      description: "Best practices and major pitfalls of modern software development.",
      coverGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    },
    {
      title: "Structure and Interpretation of Computer Programs",
      author: "Harold Abelson & Gerald Jay Sussman",
      genre: "Computer Science",
      pages: 657,
      publishedYear: 1996,
      description: "MIT textbook on functional abstractions.",
      coverGradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
    },
    {
      title: "Dune",
      author: "Frank Herbert",
      genre: "Science Fiction",
      pages: 896,
      publishedYear: 1965,
      description: "Set on the desert planet Arrakis.",
      coverGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    },
    {
      title: "Refactoring",
      author: "Martin Fowler",
      genre: "Software Engineering",
      pages: 448,
      publishedYear: 2018,
      description: "Catalog of refactorings with modern examples.",
      coverGradient: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    },
    {
      title: "Atomic Habits",
      author: "James Clear",
      genre: "Self Improvement",
      pages: 320,
      publishedYear: 2018,
      description: "A practical framework for building good habits.",
      coverGradient: "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
    },
    {
      title: "Sapiens",
      author: "Yuval Noah Harari",
      genre: "History",
      pages: 498,
      publishedYear: 2014,
      description: "How an insignificant ape became the ruler of planet Earth.",
      coverGradient: "linear-gradient(135deg, #059669 0%, #14b8a6 100%)",
    },
    {
      title: "The Design of Everyday Things",
      author: "Don Norman",
      genre: "Design & UX",
      pages: 368,
      publishedYear: 2013,
      description: "The ultimate primer on human-centered design.",
      coverGradient: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)",
    },
    {
      title: "Deep Work",
      author: "Cal Newport",
      genre: "Productivity",
      pages: 304,
      publishedYear: 2016,
      description: "Rules for focused success in a distracted world.",
      coverGradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    },
  ];

  const books = await Promise.all(
    sampleBooks.map(async (book) => {
      const genre = genreMap.get(book.genre);
      if (!genre) throw new Error(`Genre "${book.genre}" not found for "${book.title}"`);

      const isbn = `978-${uid()}`;

      return prisma.book.upsert({
        where: { isbn },
        update: {},
        create: {
          id: `book-${uid()}`,
          isbn,
          title: book.title,
          author: book.author,
          genreId: genre.id,
          pages: book.pages,
          publishedYear: book.publishedYear,
          description: book.description,
          coverGradient: book.coverGradient,
          totalCopies: 3,
          availableCopies: 3,
          shelfLocation: `${genre.name} - A1`,
        },
      });
    }),
  );


  const members = await Promise.all([
    prisma.member.upsert({
      where: { email: "alex.wright@university.edu" },
      update: {},
      create: {
        id: `mem-001`,
        name: "Alexander Wright",
        email: "alex.wright@university.edu",
        phone: "+1 (555) 234-8901",
        membershipNumber: "LIB-2024-001",
        status: "active",
        bio: "Senior researcher in Distributed Systems.",
        hobbies: "Reading, hiking",
      },
    }),
    prisma.member.upsert({
      where: { email: "elena.rostova@designlab.io" },
      update: {},
      create: {
        id: `mem-002`,
        name: "Elena Rostova",
        email: "elena.rostova@designlab.io",
        phone: "+1 (555) 872-3419",
        membershipNumber: "LIB-2024-002",
        status: "active",
        bio: "Product Designer exploring accessibility, typography and behavioral design.",
        hobbies: "Typography, behavioral design",
      },
    }),
    prisma.member.upsert({
      where: { email: "marcus.chen@techstartup.com" },
      update: {},
      create: {
        id: `mem-003`,
        name: "Marcus Chen",
        email: "marcus.chen@techstartup.com",
        phone: "+1 (555) 948-1203",
        membershipNumber: "LIB-2024-003",
        status: "active",
        bio: "Fullstack developer and open source maintainer.",
        hobbies: "Open source, cycling",
      },
    }),
    prisma.member.upsert({
      where: { email: "sophia.patel@biotech.org" },
      update: {},
      create: {
        id: `mem-004`,
        name: "Sophia Patel",
        email: "sophia.patel@biotech.org",
        phone: "+1 (555) 439-0192",
        membershipNumber: "LIB-2024-004",
        status: "active",
        bio: "Computational biologist studying algorithmic models of genetics.",
        hobbies: "Reading, gardening",
      },
    }),
    prisma.member.upsert({
      where: { email: "devon.vance@freelance.net" },
      update: {},
      create: {
        id: `mem-005`,
        name: "Devon Vance",
        email: "devon.vance@freelance.net",
        phone: "+1 (555) 601-3829",
        membershipNumber: "LIB-2024-005",
        status: "suspended",
        bio: "Independent writer with multiple pending overdue book fines.",
        hobbies: "Writing, hiking",
      },
    }),
  ]);


  const loans = await Promise.all([
    prisma.loan.upsert({
      where: { id: `loan-201` },
      update: {},
      create: {
        id: `loan-201`,
        bookId: books[0].id,
        memberId: members[0].id,
        borrowDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 4 * 86400000).toISOString(),
        status: "active",
        notes: "Renewed once for thesis research.",
      },
    }),
    prisma.loan.upsert({
      where: { id: `loan-202` },
      update: {},
      create: {
        id: `loan-202`,
        bookId: books[1].id,
        memberId: members[2].id,
        borrowDate: new Date(Date.now() - 18 * 86400000).toISOString(),
        dueDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        status: "overdue",
        fineAmount: 2.0,
        notes: "Automated overdue reminder sent to email.",
      },
    }),
    prisma.loan.upsert({
      where: { id: `loan-203` },
      update: {},
      create: {
        id: `loan-203`,
        bookId: books[3].id,
        memberId: members[3].id,
        borrowDate: new Date(Date.now() - 6 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 8 * 86400000).toISOString(),
        status: "active",
      },
    }),
    prisma.loan.upsert({
      where: { id: `loan-204` },
      update: {},
      create: {
        id: `loan-204`,
        bookId: books[4].id,
        memberId: members[1].id,
        borrowDate: new Date(Date.now() - 24 * 86400000).toISOString(),
        dueDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        status: "overdue",
        fineAmount: 5.0,
        notes: "Member contacted; promised return by weekend.",
      },
    }),
    prisma.loan.upsert({
      where: { id: `loan-205` },
      update: {},
      create: {
        id: `loan-205`,
        bookId: books[9].id,
        memberId: members[0].id,
        borrowDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 9 * 86400000).toISOString(),
        status: "active",
      },
    }),
    prisma.loan.upsert({
      where: { id: `loan-206` },
      update: {},
      create: {
        id: `loan-206`,
        bookId: books[2].id,
        memberId: members[1].id,
        borrowDate: new Date(Date.now() - 25 * 86400000).toISOString(),
        dueDate: new Date(Date.now() - 11 * 86400000).toISOString(),
        returnDate: new Date(Date.now() - 12 * 86400000).toISOString(),
        status: "returned",
        notes: "Returned on time in pristine condition.",
      },
    }),
  ]);


  const activities = await Promise.all([
    prisma.activity.upsert({
      where: { id: `act-1` },
      update: {},
      create: {
        id: `act-1`,
        type: "borrow",
        title: "Book Checked Out",
        description: "Alexander Wright borrowed \"Designing Data-Intensive Applications\"",
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
    }),
    prisma.activity.upsert({
      where: { id: `act-2` },
      update: {},
      create: {
        id: `act-2`,
        type: "return",
        title: "Book Returned",
        description: "Elena Rostova returned \"The Pragmatic Programmer\"",
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
    }),
    prisma.activity.upsert({
      where: { id: `act-3` },
      update: {},
      create: {
        id: `act-3`,
        type: "add_book",
        title: "New Acquisition Added",
        description: "Added \"Designing Data-Intensive Applications\" (3 copies)",
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
      },
    }),
    prisma.activity.upsert({
      where: { id: `act-4` },
      update: {},
      create: {
        id: `act-4`,
        type: "add_member",
        title: "New Member Registered",
        description: "Sophia Patel registered with ID LIB-2024-004",
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    }),
    prisma.activity.upsert({
      where: { id: `act-5` },
      update: {},
      create: {
        id: `act-5`,
        type: "borrow",
        title: "Book Checked Out",
        description: "Marcus Chen borrowed \"Clean Code\"",
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    }),
  ]);

  console.log(`✅ Seed complete:`);
  console.log(`   ${genres.length} genres`);
  console.log(`   ${books.length} books`);
  console.log(`   ${members.length} members`);
  console.log(`   ${loans.length} loans`);
  console.log(`   ${activities.length} activities`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
