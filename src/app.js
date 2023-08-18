const { ApolloServer } = require("@apollo/server");
const { GraphQLError } = require("graphql");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Book = require("./models/bookModel");
const Author = require("./models/authorModel");

const typeDefs = `
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

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book

    editAuthor(name: String! setBornTo: Int!): 
    
    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token
  }
`;

const resolvers = {
  Query: {
    bookCount: async () => await Book.countDocuments(),
    authorCount: async () => await Author.countDocuments(),
    allBooks: async (root, args) => {
      let query = {};
      if (args.author) {
        const authorDoc = await Author.findOne({ name: args.author });
        if (authorDoc) query.author = authorDoc._id;
        else return [];
      }
      if (args.genre) query.genres = { $in: [args.genre] };

      return await Book.find(query).populate("author");
    },
    allAuthors: async () => await Author.find({}),
    me: (root, args, context) => context.currentUser,
  },

  Author: {
    bookCount: async (root) => {
      return await Book.countDocuments({ author: root._id });
    },
  },

  Mutation: {
    addBook: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }
      if (args.title.length < 3)
        throw new GraphQLError("Book title too short", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      if (args.author.length < 3)
        throw new GraphQLError("Author name too short", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });

      let author = await Author.findOne({ name: args.author });

      if (!author) {
        author = new Author({ name: args.author });
        await author.save();
      }

      const book = new Book({ ...args, author });
      return await book.save().catch((error) => {
        throw new GraphQLError("Could not add book", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      });
    },

    editAuthor: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }
      const author = await Author.findOne({ name: args.name });
      if (!author) return null;

      author.born = args.setBornTo;
      return await author.save().catch((error) => {
        throw new GraphQLError("Editing Author failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      });
    },

    createUser: async (root, args) => {
      let user = new User({
        username: args.username,
        password: args.password,
      });

      const saltRounds = 10;
      user.password = await bcrypt.hash(user.password, saltRounds);

      return user.save().catch((error) => {
        throw new GraphQLError("Creating the user failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      });
    },

    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      const isCorrectPass =
        user === null ? false : await bcrypt.compare(password, user.password);

      if (!user || !isCorrectPass) {
        throw new GraphQLError("wrong credentials", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

module.exports = server;
