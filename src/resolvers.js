const { GraphQLError } = require("graphql");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Book = require("./models/bookModel");
const Author = require("./models/authorModel");
const User = require("./models/userModel");

const { PubSub } = require("graphql-subscriptions");
const pubsub = new PubSub();

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
    me: (root, args, context) => {
      if (!context.currentUser.favoriteGenre)
        return { ...context.currentUser, favoriteGenre: "Genre1" };
      return context.currentUser;
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
      if (args.genres.length < 1)
        throw new GraphQLError("Books require at least 1 genre", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });

      let author = await Author.findOne({ name: args.author });

      if (!author) author = new Author({ name: args.author, bookCount: 0 });

      author.bookCount++;
      await author.save();

      const book = new Book({ ...args, author });

      try {
        await book.save();
      } catch (error) {
        throw new GraphQLError("Could not add book", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      }

      pubsub.publish("BOOK_ADDED", { bookAdded: book });

      return book;
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
        favoriteGenre: args.favoriteGenre,
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
        user === null
          ? false
          : await bcrypt.compare(args.password, user.password);

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
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator("BOOK_ADDED"),
    },
  },
};

module.exports = resolvers;
