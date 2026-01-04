import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export const useAutoSave = (content: string, filePath: string) => {
    const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    useEffect(() => {
        if (!content || !filePath) return;
        setStatus('unsaved');

        const timer = setTimeout(async () => {
            setStatus('saving');
            try {
                // Using the existing endpoint for writing files
                await apiClient.post('/fs/write-file', { path: filePath, content });
                setStatus('saved');
            } catch (err) {
                console.error("Auto-save failed:", err);
                setStatus('unsaved'); // Retry logic could be added here
            }
        }, 1000); // Wait 1000ms after last keystroke

        return () => clearTimeout(timer);
    }, [content, filePath]);

    return status;
};