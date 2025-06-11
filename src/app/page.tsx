"use client";

import React, { useState, useRef, ChangeEvent, DragEvent } from "react";
import styles from "./page.module.css";

interface AnalysisResult {
  scores: { [key: string]: number };
  overallFeedback: string;
  observation: string;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setAnalysisResult(null); // Clear previous results
      setError(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file && (file.type === "audio/mpeg" || file.type === "audio/wav")) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setAnalysisResult(null); // Clear previous results
      setError(null);
    } else {
      setError("Please drop a valid .mp3 or .wav audio file.");
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleProcessFeedback = async () => {
    if (!audioFile) {
      setError("Please upload an audio file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioFile);

      const response = await fetch("/api/analyze-call", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze audio.");
      }

      const data: AnalysisResult = await response.json();
      setAnalysisResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0 && score <= 49) return styles.scoreFail;
    if (score >= 50 && score <= 79) return styles.scoreMedium;
    if (score >= 80 && score <= 100) return styles.scorePass;
    return "";
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>AI Feedback Form</h1>
        <p>Upload an audio file (.mp3 or .wav) to get AI-powered feedback.</p>
      </header>

      <main className={styles.mainContent}>
        <section
          className={styles.uploadSection}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept=".mp3,.wav"
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: "none" }}
          />
          {audioFile ? (
            <p className={styles.uploadedFileName}>
              File selected: {audioFile.name}
            </p>
          ) : (
            <p>Drag & Drop your audio file here, or click to select</p>
          )}
          <p className={styles.supportedFormats}>(.mp3 or .wav)</p>
        </section>

        {audioUrl && (
          <section className={styles.audioPlayerSection}>
            <h2>Audio Playback</h2>
            <audio controls src={audioUrl} className={styles.audioPlayer}>
              Your browser does not support the audio element.
            </audio>
          </section>
        )}

        <button
          onClick={handleProcessFeedback}
          className={styles.processButton}
          disabled={!audioFile || loading}
        >
          {loading ? "Processing..." : "Process Feedback"}
        </button>

        {error && <p className={styles.errorMessage}>{error}</p>}

        {analysisResult && (
          <section className={styles.resultsSection}>
            <h2>Analysis Results</h2>
            <div className={styles.scoresGrid}>
              {Object.entries(analysisResult.scores).map(([key, value]) => (
                <div key={key} className={styles.scoreItem}>
                  <p className={styles.scoreLabel}>
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())}
                    :
                  </p>
                  <p className={`${styles.scoreValue} ${getScoreColor(value)}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className={styles.feedbackText}>
              <h3>Overall Feedback:</h3>
              <p>{analysisResult.overallFeedback}</p>
            </div>
            <div className={styles.feedbackText}>
              <h3>Observation:</h3>
              <p>{analysisResult.observation}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
