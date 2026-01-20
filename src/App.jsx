import React, { useMemo, useRef, useState } from 'react';

const RESOLUTIONS = [
  { label: 'Native (Full Screen)', width: null, height: null },
  { label: '1920 x 1080 (1080p)', width: 1920, height: 1080 },
  { label: '1280 x 720 (720p)', width: 1280, height: 720 },
  { label: '854 x 480 (480p)', width: 854, height: 480 }
];

const pickMp4MimeType = () => {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401E,mp4a.40.2',
    'video/mp4'
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
};

const App = () => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const [savePath, setSavePath] = useState('');

  const selectedResolution = useMemo(
    () => RESOLUTIONS[resolutionIndex],
    [resolutionIndex]
  );

  const stopTracks = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const setupStream = async () => {
    setError('');
    const sources = await window.electronAPI.getScreenSources();
    const screenSource = sources[0];

    if (!screenSource) {
      throw new Error('No screen sources available.');
    }

    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id
        }
      }
    };

    if (selectedResolution.width && selectedResolution.height) {
      constraints.video.mandatory.maxWidth = selectedResolution.width;
      constraints.video.mandatory.maxHeight = selectedResolution.height;
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (selectedResolution.width && selectedResolution.height) {
      const [track] = stream.getVideoTracks();
      await track.applyConstraints({
        width: selectedResolution.width,
        height: selectedResolution.height
      });
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    return stream;
  };

  const startRecording = async () => {
    try {
      setSavePath('');
      const stream = await setupStream();
      const mimeType = pickMp4MimeType();

      if (!mimeType) {
        setError('MP4 recording is not supported in this environment.');
        stopTracks();
        return;
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const result = await window.electronAPI.saveRecording(arrayBuffer);
        if (!result.canceled) {
          setSavePath(result.filePath);
        }
        stopTracks();
        setStatus('idle');
      };

      recorder.start(1000);
      setStatus('recording');
    } catch (err) {
      setError(err.message || 'Unable to start recording.');
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setStatus('stopping');
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setStatus('paused');
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setStatus('recording');
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Perfex Full Screen Recorder</h1>
        <p>Record your entire desktop to MP4 with pause and resume controls.</p>
      </header>

      <section className="app__controls">
        <div className="control-group">
          <label htmlFor="resolution">Resolution</label>
          <select
            id="resolution"
            value={resolutionIndex}
            onChange={(event) => setResolutionIndex(Number(event.target.value))}
            disabled={status !== 'idle'}
          >
            {RESOLUTIONS.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="button-row">
          <button
            className="primary"
            type="button"
            onClick={startRecording}
            disabled={status !== 'idle'}
          >
            Start Recording
          </button>
          <button
            type="button"
            onClick={pauseRecording}
            disabled={status !== 'recording'}
          >
            Pause
          </button>
          <button
            type="button"
            onClick={resumeRecording}
            disabled={status !== 'paused'}
          >
            Resume
          </button>
          <button
            type="button"
            onClick={stopRecording}
            disabled={status === 'idle' || status === 'stopping'}
          >
            Stop
          </button>
        </div>
      </section>

      <section className="app__preview">
        <video ref={videoRef} autoPlay muted playsInline />
      </section>

      {status !== 'idle' && (
        <div className="status">
          Status: <strong>{status}</strong>
        </div>
      )}

      {savePath && (
        <div className="status status--success">
          Saved to: <strong>{savePath}</strong>
        </div>
      )}

      {error && (
        <div className="status status--error">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
