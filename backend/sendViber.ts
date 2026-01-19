import axios from "axios";
export async function sendViberMessage(message: string) {
  console.log("Sending Viber message:", message);
  const url = "https://chatapi.viber.com/pa/send_message";

  const data = {
    receiver: process.env.VIBER_RECEIVER_ID,
    type: "text",
    text: message,
  };

  const headers = {
    "Content-Type": "application/json",
    "X-Viber-Auth-Token": process.env.VIBER_AUTH_TOKEN,
  };

  try {
    const response = await axios.post(url, data, { headers });
    return response.data;
  } catch (error: any) {
  }
}


// catch any error 
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  sendViberMessage('Uncaught Exception: ' + err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  sendViberMessage('Unhandled Rejection: ' + reason);
});
