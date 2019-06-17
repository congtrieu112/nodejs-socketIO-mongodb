import * as express from "express";
// import * as WebSocket from "ws";
import { createServer, Server } from "http";
import * as socketIo from "socket.io";
import { Message } from "./model";
import { MongoClient } from "mongodb";
var autoIncrement = require("mongodb-autoincrement");
var auth = require("./api/server");
class App {
  public static readonly PORT: number = 9090;
  private app: express.Application;
  private server: Server;
  // private wss: WebSocket;
  private io: socketIo.Server;
  private port: string | number;
  private url: string;
  private db: any;

  constructor() {
    // this.crateApp();
    // this.config();
    // this.createServer();
    // this.createWssServer();
    // this.sockets();
    // this.mountRoutes();
    // this.socketIolite();
    this.runAction();
  }
  private async runAction(): Promise<void> {
    this.createApp();
    this.config();
    this.createServer();
    this.sockets();
    this.socketIolite();
    this.mountRoutes();
    this.setUrl();
    await this.setDb();
    this.connectDb();
  }

  private setUrl(): void {
    this.url = "mongodb://localhost:27017";
  }

  public async checkExitCollect(db, collectName) {
    var result = false;
    await db.collections().then(data => {
      for (let name of data) {
        if (collectName === name.namespace) {
          result = true;
        }
      }
    });
    return result;
  }
  private async setDb(): Promise<any> {
    var dbc = null;
    await MongoClient.connect(this.url, { useNewUrlParser: true })
      .then(db => {
        // <- db as first argument
        this.db = db.db("cfs");
        dbc = this.db;
      })
      .catch(err => {
        console.log(err);
      });
    return dbc;
  }

  private async connectDb(): Promise<void> {
    const checkCollectCfsList = await this.checkExitCollect(
      this.db,
      "cfs.cfs_lists"
    );
    if (!checkCollectCfsList) {
      this.db.createCollection("cfs_lists", (err, res) => {
        if (err) throw err;
        console.log("Collection created!");
      });
    }
  }

  private createApp(): void {
    this.app = express();
  }

  private config(): void {
    this.port = process.env.PORT || App.PORT;
  }

  private sockets(): void {
    this.io = socketIo(this.server);
  }

  private createServer(): void {
    this.server = createServer(this.app);
  }
  private async getNextSequenceValue(sequenceName: string): Promise<Number> {
    var result = 0;
    // await autoIncrement
    //   .getNextSequence(this.db, sequenceName)
    //   .then(autoIndex => {
    //     result = autoIndex;
    //   })
    //   .catch(err => {
    //     console.log(err);
    //   });

    var kq = await autoIncrement.getNextSequence(
      this.db,
      sequenceName,
      (err, autoIndex) => {}
    );
    //   (err, autoIndex) => {
    //     return (result = autoIndex);
    //   }
    // );
    console.log("sau ", result, kq);
    return result;
  }

  private mountRoutes(): void {
    this.app.all("/*", function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      next();
    });
    auth.auth();
    const router = express.Router();
    router.get("/", (req, res) => {
      res.json({
        message: "Hello World!"
      });
    });
    router.post("/create-cfs", (rep, res) => {
      autoIncrement.getNextSequence(this.db, "productid", (err, autoIndex) => {
        const dataInsert = {
          _id: autoIndex,
          product_name: "",
          category: ""
        };
        const collection = this.db.collection("cfs_lists");
        collection.insert(dataInsert, (err, res) => {
          if (err) throw err;
        });
        res.json(dataInsert);
        //socket.emit("list-new-cfs", dataInsert);
      });
    });

    this.app.use(["/", "/create-cfs"], router);
    // this.app.use("/create-cfs", router);
  }

  private socketIolite(): void {
    this.server.listen(this.port, () => {
      console.log("Running server on port %s", this.port);
    });

    this.io.on("connect", (socket: any) => {
      console.log(
        "Connected client on port %s.",
        this.port,
        "socket id:",
        socket.id,
        "token",
        socket.request._query.token
      );
      socket.on("message", (m: Message) => {
        console.log("[server](message): %s", JSON.stringify(m));
        this.io.emit("message", m);
      });

      socket.on("list-new-cfs", async (m: any) => {
        console.log("[server](message): %s", JSON.stringify(m));
        const message = {
          id: 10,
          address: ""
        };

        autoIncrement.getNextSequence(
          this.db,
          "productid",
          (err, autoIndex) => {
            const dataInsert = {
              _id: autoIndex,
              product_name: "",
              category: ""
            };
            const collection = this.db.collection("cfs_lists");
            collection.insert(dataInsert, (err, res) => {
              if (err) throw err;
            });
            socket.emit("list-new-cfs", dataInsert);
          }
        );
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

export default new App();
