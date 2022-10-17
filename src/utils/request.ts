import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

console.log(process.env.API_URL,"api");

export const HOST = process.env.API_URL;

export const BASE_URL = `${HOST}/`;

const API = axios.create({ baseURL: BASE_URL });

export default API;
