import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT || 4000);

createApp()
  .then((app) => {
    app.listen(port, () => {
      console.info(`Task workflow API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
  });
