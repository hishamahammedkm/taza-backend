import dotenv from "dotenv";
import { httpServer } from "./app.js";
import connectDB from "./db/index.js";
import supabase from "./supabase.js";
import { User } from "./models/apps/auth/user.models.js";
import { UserRolesEnum } from "./constants.js";

dotenv.config({
  path: "./.env",
});

/**
 * Starting from Node.js v14 top-level await is available and it is only available in ES modules.
 * This means you can not use it with common js modules or Node version < 14.
 */
const majorNodeVersion = +process.env.NODE_VERSION?.split(".")[0] || 0;

const startServer = () => {
  httpServer.listen(process.env.PORT || 8080, () => {
    console.info(
      `📑 Visit the documentation at: http://localhost:${
        process.env.PORT || 8080
      }`
    );
    console.log("⚙️  Server is running on port: " + process.env.PORT);
  });
};

if (majorNodeVersion >= 14) {
  try {
    await connectDB();
    startServer();
  } catch (err) {
    console.log("Mongo db connect error: ", err);
  }
} else {
  connectDB()
    .then(() => {
      startServer();
    })
    .catch((err) => {
      console.log("Mongo db connect error: ", err);
    });
}

const listenForChanges = () => {
  const subscription = supabase
    .channel("table-filter-changes")
    .on(
      "postgres_changes",
      {
        event: "*", // Listen to all events, you can specify "INSERT", "UPDATE", etc.
        schema: "public",
        table: "user_profile",
      },
      async (payload) => {
        try {
          console.log("Change detected:", payload);

          const { email, id } = payload.new;

          const existedUser = await User.findOne({
            $or: [{ id: id }, { email }],
          });

          if (existedUser) {
            throw new Error("User with email or username already exists");
          }
          const user = await User.create({
            id: id,
            email,
            password: "12345678",
            username: email,
          });
          await user.save();
        } catch (error) {
          console.log("user creating error--", error);
        }
      }
    )
    .subscribe();

  // Optionally, handle subscription error events
  subscription.on("error", (error) => {
    console.error("Subscription error:", error);
  });

  subscription.on("close", () => {
    console.log("Subscription closed.");
  });
};
listenForChanges();
