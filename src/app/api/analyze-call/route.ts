import { NextRequest, NextResponse } from "next/server";

// Map to store the last request timestamp for each IP address
const lastRequestTime: Map<string, number> = new Map();
// Define a rate limit interval (e.g., 10 seconds)
const RATE_LIMIT_INTERVAL_MS = 10 * 1000;

// Mock data for analysis parameters as defined in the PDF
const MOCK_CALL_EVALUATION_PARAMETERS = [
  {
    key: "greeting",
    name: "Greeting",
    weight: 5,
    desc: "Call opening within 5 seconds",
    inputType: "PASS_FAIL",
  },
  {
    key: "collectionUrgency",
    name: "Collection Urgency",
    weight: 15,
    desc: "Call urgency, cross-questioning",
    inputType: "SCORE",
  },
  {
    key: "rebatedCustomerOffer",
    name: "Rebated Customer Offer",
    weight: 15,
    desc: "Customer offer provided for collections",
  },
  {
    key: "callEtiquette",
    name: "Call Etiquette",
    weight: 10,
    desc: "Customer response pending",
    inputType: "SCORE",
  },
  {
    key: "callDisclaimer",
    name: "Call Disclaimer",
    weight: 5,
    desc: "Take permission before recording",
    inputType: "PASS_FAIL",
  },
  {
    key: "correctDisposition",
    name: "Correct Disposition",
    weight: 10,
    desc: "Choose correct category with remarks",
    inputType: "PASS_FAIL",
  },
  {
    key: "callClosing",
    name: "Call Closing",
    weight: 5,
    desc: "Thank you for your proper support",
    inputType: "PASS_FAIL",
  },
  {
    key: "fatalDataDisclosure",
    name: "Fatal Data Disclosure",
    weight: 15,
    desc: "Disclosure of info type",
    inputType: "PASS_FAIL",
  },
  {
    key: "fatalTapeDisclaimer",
    name: "Tape Disclaimer",
    weight: 15,
    desc: "Disclaimer about recording",
    inputType: "PASS_FAIL",
  },
  {
    key: "fatalToneLanguage",
    name: "Tone & Language",
    weight: 10,
    desc: "Abusive or threatening speech",
    inputType: "PASS_FAIL",
  },
];

export async function POST(req: NextRequest) {
  try {
    // Get user IP from x-forwarded-for header, fallback for local development
    const userIp = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // Basic Rate Limiting Check
    const now = Date.now();
    if (lastRequestTime.has(userIp)) {
      const lastTime = lastRequestTime.get(userIp)!;
      if (now - lastTime < RATE_LIMIT_INTERVAL_MS) {
        console.warn(`Rate limit hit for IP: ${userIp}`);
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          { status: 429 }
        );
      }
    }
    // Update the last request time for this IP
    lastRequestTime.set(userIp, now);

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: "AssemblyAI API key not configured." },
        { status: 500 }
      );
    }

    console.log(
      `Received file: ${audioFile.name} (${audioFile.type}, ${audioFile.size} bytes)`
    );

    // 1. Send audio file to AssemblyAI for Transcription
    // AssemblyAI recommends sending audio as raw binary data or multipart/form-data
    // The file directly from formData should work.
    const assemblyAIResponse = await fetch(
      "https://api.assemblyai.com/v2/upload",
      {
        method: "POST",
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
          "Content-Type": "application/octet-stream", // Recommended for direct file upload
        },
        body: await audioFile.arrayBuffer(), // Send as ArrayBuffer
      }
    );

    if (!assemblyAIResponse.ok) {
      const errorData = await assemblyAIResponse.json();
      console.error("AssemblyAI Upload API Error:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to upload audio to AssemblyAI." },
        { status: assemblyAIResponse.status }
      );
    }

    const uploadData = await assemblyAIResponse.json();
    const audioUrl = uploadData.upload_url;

    // Now, send the uploaded audio URL to AssemblyAI for transcription
    const transcribeResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          // You can add more configuration here like language_code, speaker_labels, etc.
        }),
      }
    );

    if (!transcribeResponse.ok) {
      const errorData = await transcribeResponse.json();
      console.error("AssemblyAI Transcribe API Error:", errorData);
      return NextResponse.json(
        {
          error:
            errorData.error || "Failed to transcribe audio with AssemblyAI.",
        },
        { status: transcribeResponse.status }
      );
    }

    const transcriptData = await transcribeResponse.json();
    const transcriptId = transcriptData.id;

    // AssemblyAI transcription is asynchronous, so we poll for the result
    let transcript = "";
    let status = transcriptData.status;

    while (status !== "completed" && status !== "error") {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Poll every 3 seconds
      const pollResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            Authorization: ASSEMBLYAI_API_KEY,
          },
        }
      );

      if (!pollResponse.ok) {
        const errorData = await pollResponse.json();
        console.error("AssemblyAI Poll API Error:", errorData);
        return NextResponse.json(
          { error: errorData.error || "Failed to poll transcription status." },
          { status: pollResponse.status }
        );
      }

      const pollData = await pollResponse.json();
      status = pollData.status;
      if (status === "completed") {
        transcript = pollData.text;
      } else if (status === "error") {
        console.error("AssemblyAI Transcription Error:", pollData.error);
        return NextResponse.json(
          { error: pollData.error || "AssemblyAI transcription failed." },
          { status: 500 }
        );
      }
    }

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcription failed or empty." },
        { status: 500 }
      );
    }

    console.log("Transcribed Text (AssemblyAI):", transcript);

    // 2. MOCK AI Analysis Logic (still mocked due to time constraints)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 1000 + 500)
    );

    const mockScores: { [key: string]: number } = {};
    MOCK_CALL_EVALUATION_PARAMETERS.forEach((param) => {
      if (param.inputType === "SCORE") {
        // Score can be any number between 0 and the weight
        mockScores[param.key] = Math.floor(Math.random() * (param.weight + 1));
      } else if (param.inputType === "PASS_FAIL") {
        // Score should be either 0 or equal to the weight
        mockScores[param.key] = Math.random() > 0.5 ? param.weight : 0;
      }
    });

    const mockOverallFeedback = `This feedback is based on the transcribed text: "${transcript.substring(
      0,
      Math.min(transcript.length, 100)
    )}...". The agent communicated clearly and empathetically, effectively addressing the customer's initial concerns. However, there was a slight delay in confirming the customer's identity at the beginning of the call. Further training on efficient data verification processes would be beneficial. The closing was professional and clear.`;
    const mockObservation = `This observation is based on the transcribed text: "${transcript.substring(
      0,
      Math.min(transcript.length, 100)
    )}...". Customer mentioned difficulty understanding initial instructions. Agent calmly re-explained. No discernible background noise. Call duration: Mock 4:30.`;

    const responseData = {
      scores: mockScores,
      overallFeedback: mockOverallFeedback,
      observation: mockObservation,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
