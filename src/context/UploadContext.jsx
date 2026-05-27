import { createContext, useContext, useState } from 'react';

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [uploadState, setUploadState] = useState(null);
  // uploadState shape: { uploading, progress: { current, total, saved }, result, filename, period }

  const startUpload = (filename, period) => {
    setUploadState({ uploading: true, progress: { current: 0, total: 0, saved: 0 }, result: null, filename, period });
  };

  const updateProgress = (progress) => {
    setUploadState(prev => prev ? { ...prev, progress } : prev);
  };

  const finishUpload = (result) => {
    setUploadState(prev => prev ? { ...prev, uploading: false, result } : prev);
  };

  const clearUpload = () => setUploadState(null);

  return (
    <UploadContext.Provider value={{ uploadState, startUpload, updateProgress, finishUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}