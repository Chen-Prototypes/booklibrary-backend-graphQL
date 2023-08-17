const { ApolloServer } = require("@apollo/server");

const mongoose = require("mongoose");
const Book = require("./models/bookModel");
const Author = require("./models/authorModel");

const typeDefs = `
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String genre: String): [Book!]!
    allAuthors: [Author!]!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    bookCount: Int!
    id: ID!
  }

  type Mutation {
    addBook(
        title: String!
        author: String!
        published: Int!
        genres: [String!]!
    ): Book

    editAuthor(name: String! setBornTo: Int!): Author
  }
`;

const resolvers = {
  Query: {
    bookCount: async () => await Book.countDocuments(),
    authorCount: async () => await Author.countDocuments(),
    allBooks: async (root, args) => {
      let query = {};
      if (args.author) query.author = args.author;
      if (args.genre) query.genres = { $in: [args.genre] };

      return await Book.find(query).populate("author");
    },
    allAuthors: async () => await Author.find({}),
  },

  Author: {
    bookCount: async (root) => {
      return await Book.countDocuments({ author: root._id });
    },
  },

  Mutation: {
    addBook: async (root, args) => {
      let author = await Author.findOne({ name: args.author });

      if (!author) {
        author = new Author({ name: args.author });
        await author.save();
      }

      const book = new Book({ ...args, author });
      return await book.save();
    },

    editAuthor: async (root, args) => {
      const author = await Author.findOne({ name: args.name });
      if (!author) return null;

      author.born = args.setBornTo;
      return await author.save();
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

module.exports = server;