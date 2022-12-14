const bodyParser = require("body-parser");
import express from "express";
const app = express();
import cors from "cors";
import dotenv from "dotenv";
import mongoose, { ConnectOptions } from "mongoose";
import { ErrorHandler } from "./src/middlewares/errorHandler";
import Users from "./src/routes/Users";
import {formatMessage} from "./src/utils/messages";
import axios from "axios";
import {Tracks} from "./src/utils/tracks";

require("dotenv").config();

import {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
  getUsers,
} from "./src/utils/users";
import API from "./src/utils/request";
import { getTracks, tracksSeed } from "./src/utils/tracks";

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

dotenv.config();


const PORTNUMBER: number = parseInt(process.env.PORT) || 8080;

app.use("/user", Users);

app.use(ErrorHandler);

var server = app.listen(PORTNUMBER, (): void => {
	console.log(`Server is running on ${PORTNUMBER}`);
});

var io = require("socket.io")(server,{
  cors: {
	origin: process.env.CLIENT_URL,
	methods: ["GET", "POST","PUT"]
  }
});

const botName = "Vinyl";
var counter = 30;
let leaderBoard:any[]=[];
  
  // Run when client connects
io.on("connection", (socket:any) => {

	socket.on("joinRoom", (data:any) => {
	
		const user = userJoin(socket.id, data.username, data.room_id);

		//joining room using socket id
		socket.join(user.room);
		
		const userName=data.username;
		
		if(data.type === "admin"){
			const addToRedis = async () => {
			try {
				const response = await API.post("/room/create",{
					admin_id:data.username,
					room_id:data.room_id,
				})
			
				console.log(data.track_ids,"tracks");
				data.track_ids.sort( () => Math.random() - 0.5) ;
				data.track_ids = data.track_ids.slice(0, data.rounds)
				const tracksRes = await API.post("/questions/create",{
					track_ids:data.track_ids,
					room_id:data.room_id,
					limit: data.rounds
				})
	
				console.log(data.rounds,"rounds");
				console.log(tracksRes.data,"trackss");

				const testVar = tracksSeed(tracksRes.data.questions);		 

				socket.emit('player-joined',data.username);
			}
			catch (err) {
				console.log(err);
			}
		}
		
			addToRedis();
		}
		else{
			const addToRedis = async () => {
			try {
				const response = await API.post("/room/add_player",{
					room_id:data.room_id,
					user_id:data.username
				})

				socket.to(user.room).emit('player-joined',data.username);
				console.log(response.data);
			}
			catch (err) {
			//catch err
				console.log(err);
			}
		}
	
			addToRedis();
		}

		// Welcome current user
		socket.emit("message", formatMessage(botName, "Welcome to Vinyl!",false));

		// Broadcast when a user connects
		//send to everyone except to the sender

		socket.broadcast
			.to(user.room)
			.emit(
				"message",
				formatMessage(botName, `${user.username} has joined the chat`,false)
			);

		// Send users and room info
		io.to(user.room).emit("roomUsers", {
			room: user.room,
			users: getRoomUsers(user.room),
		});

	});

	// Listen for chatMessage

	//result array
	socket.on("chatMessage", (data:any) => { 

		// console.log(data,"Data");
		const user = getCurrentUser(socket.id);
		API.post("/questions/check", {
			answer:data.message,
			question_id:data.questionId
		}).then((res:any) => {
			let correct;
			// console.log(res.data,"Data ans");
			if(res.data.result === "True"){
				// console.log("in");
				
				leaderBoard.push({key:[user.username],value:counter*10});

				correct = true;

			}
			else{
				// console.log("else");
				correct=false;
			}
			
			io.to(user.room).emit("message", formatMessage(user.username, data.message,correct));

		}).catch((err:any) => {
			console.log(err);
		});
	
	});

	socket.on("startGame",async(data:any) => {
		
		let user = getCurrentUser(socket.id);
		let tracks = getTracks();
		let rounds = tracks.length;
		getRoomUsers(user.room).map(ele=>{
			leaderBoard.push({key:[ele.username],value:0});
		})
		const scores = leaderBoard.reduce(
			(obj, item) => Object.assign(obj, { [item.key]: item.value }), {});
		try{
			const response = await API.put('/room/update_score',{
				room_id:user.room,
				scores:scores
			})
			// console.log("score-board updating")
			//socket.emit("updated-score-board",response);
			io.to(user.room).emit("updated-score-board", response.data);
			setTimeout(()=>{
				io.to(user.room).emit("updated-score-board", response.data);
			},1500)
			leaderBoard=[];
		}
		catch(err){
			console.log(err)
		}
		round(tracks,user,rounds);
	}) 
		
	const round = async(tracks:any[],user:any,rounds:number) => {
        console.log(rounds)
	
		//base cond
		if(rounds <=0){
			
			getRoomUsers(user.room).map(ele=>{
				leaderBoard.push({key:[ele.username],value:0});
			})
			const scores = leaderBoard.reduce(
				(obj, item) => Object.assign(obj, { [item.key]: item.value }), {});
			try{
				const response = await API.put('/room/update_score',{
					room_id:user.room,
					scores:scores
				})
				// console.log("score-board updating")
				//socket.emit("updated-score-board",response);
				 io.to(user.room).emit("game-end", response.data);

				
				leaderBoard=[];
			}
			catch(err){
				console.log(err)
			}

			
			return;
		}

		getRoomUsers(user.room).map(ele=>{
			leaderBoard.push({key:[ele.username],value:0});
		})
		

		//broadcast particular track
		// console.log(tracks[rounds-1],"this is the track")
		
		 io.to(user.room).emit("tracksData", {
			name: 'Paradise',
			image: 'https://c.saavncdn.com/524/Duck-Duck-Goose-English-2018-20180910145221-150x150.jpg',
			url: 'https://discord.com/channels/871306487568412692/871337440462389278/1058813086733193336',
			question_id: 'mY1CxHIY'
		  });

		 setTimeout(()=>{
			io.to(user.room).emit("tracksData", {
				name: 'Paradise',
				image: 'https://c.saavncdn.com/524/Duck-Duck-Goose-English-2018-20180910145221-150x150.jpg',
				url: 'https://discord.com/channels/871306487568412692/871337440462389278/1058813086733193336',
				question_id: 'mY1CxHIY'
			  });
		 },1500)

		var roundCountdown = setInterval(async() => {
	
			//broadcast countdown to users
			io.to(user.room).emit('counter', counter);
		
			counter--;
	
			if (counter === 0) {
				//next round
				clearInterval(roundCountdown);
				rounds--;
				
				counter=30;
				
				const scores = leaderBoard.reduce(
					(obj, item) => Object.assign(obj, { [item.key]: item.value }), {});
				  

				try{
					const response = await API.put('/room/update_score',{
						room_id:user.room,
						scores:scores
					})
					console.log("score-board updating")
				    //socket.emit("updated-score-board",response);
					io.to(user.room).emit("updated-score-board",response.data);
					leaderBoard=[];
				}
				catch(err){
					console.log(err)
				}
				

				
				round(tracks,user,rounds);
			}
		}, 1000);
	}

	socket.emit("getUsers",getUsers());

// Runs when client disconnects
	socket.on("disconnect", () => {
		const user = userLeave(socket.id);

		if (user) {
			io.to(user.room).emit(
				"message",
				formatMessage(botName, `${user.username} has left the chat`,false)
			);

		// Send users and room info
			io.to(user.room).emit("roomUsers", {
				room: user.room,
				users: getRoomUsers(user.room),
			});
		}
	});

});
