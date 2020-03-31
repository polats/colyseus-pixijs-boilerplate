import * as PIXI from "pixi.js";
import * as Viewport from "pixi-viewport";
import { Room, Client } from "colyseus.js";
import { State } from "../server/rooms/State";

// const ENDPOINT = (process.env.NODE_ENV==="development")
//     ? "ws://localhost:8080"
//     : "wss://colyseus-pixijs-boilerplate.herokuapp.com";

const HASWINDOW = typeof window !== 'undefined';
const DEV_URL = "localhost:8080"; // "127.0.0.1:8080";
const FALLBACK_GLITCH_URL = "colyseus-pixijs-boilerplate.glitch.me";

const PROTOCOL = (process.env.NODE_ENV==="production") ? "wss://" : "ws:/";
const APP_URL = (process.env.NODE_ENV==="production")
      ? (HASWINDOW
         ?  window.location.host
         :  FALLBACK_GLITCH_URL
      )
      : DEV_URL;

const ENDPOINT = PROTOCOL + APP_URL;

const WORLD_SIZE = 2000;

export const lerp = (a: number, b: number, t: number) => (b - a) * t + a

export class Application extends PIXI.Application {
    entities: { [id: string]: PIXI.Graphics } = {};
    currentPlayerEntity: PIXI.Graphics;

    client = new Client(ENDPOINT);
    room: Room<State>;

    viewport: Viewport;
    _interpolation: boolean;

    constructor () {
        super({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x0c0c0c
        });

        this.viewport = new Viewport({
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            worldWidth: WORLD_SIZE,
            worldHeight: WORLD_SIZE,
        });

        // draw boundaries of the world
        const boundaries = new PIXI.Graphics();
        boundaries.beginFill(0x000000);
        boundaries.drawRoundedRect(0, 0, WORLD_SIZE, WORLD_SIZE, 30);
        this.viewport.addChild(boundaries);

        // add viewport to stage
        this.stage.addChild(this.viewport);

        this.authenticate();

        this.interpolation = false;

        this.viewport.on("mousemove", (e) => {
            if (this.currentPlayerEntity) {
                const point = this.viewport.toLocal(e.data.global);
                this.room.send(['mouse', { x: point.x, y: point.y }]);
            }
        });
    }

    async authenticate() {
        // anonymous auth

        // await this.client.auth.login();

        console.log("Success!", this.client.auth);

        this.room = await this.client.joinOrCreate<State>("arena");

        this.room.state.entities.onAdd = (entity, sessionId: string) => {
            const color = (entity.radius < 10)
                ? 0xff0000
                : 0xFFFF0B;

            const graphics = new PIXI.Graphics();
            graphics.lineStyle(0);
            graphics.beginFill(color, 0.5);
            graphics.drawCircle(0, 0, entity.radius);
            graphics.endFill();

            graphics.x = entity.x;
            graphics.y = entity.y;
            this.viewport.addChild(graphics);

            this.entities[sessionId] = graphics;

            // detecting current user
            if (sessionId === this.room.sessionId) {
                this.currentPlayerEntity = graphics;
                this.viewport.follow(this.currentPlayerEntity);
            }

            entity.onChange = (changes) => {
                const color = (entity.radius < 10) ? 0xff0000 : 0xFFFF0B;

                const graphics = this.entities[sessionId];

                // set x/y directly if interpolation is turned off
                if (!this._interpolation) {
                    graphics.x = entity.x;
                    graphics.y = entity.y;
                }

                graphics.clear();
                graphics.lineStyle(0);
                graphics.beginFill(color, 0.5);
                graphics.drawCircle(0, 0, entity.radius);
                graphics.endFill();
            }
        };

        this.room.state.entities.onRemove = (_, sessionId: string) => {
            this.viewport.removeChild(this.entities[sessionId]);
            this.entities[sessionId].destroy();
            delete this.entities[sessionId];
        };
    }

    set interpolation (bool: boolean) {
        this._interpolation = bool;

        if (this._interpolation) {
            this.loop();
        }
    }

    loop () {
        for (let id in this.entities) {
            this.entities[id].x = lerp(this.entities[id].x, this.room.state.entities[id].x, 0.2);
            this.entities[id].y = lerp(this.entities[id].y, this.room.state.entities[id].y, 0.2);
        }

        // continue looping if interpolation is still enabled.
        if (this._interpolation) {
            requestAnimationFrame(this.loop.bind(this));
        }
    }
}
