import axios from "axios";
export async function sendViberMessage(message: string) {
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
