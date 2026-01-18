import React from 'react';
import Joyride, { Step } from '@list-labs/react-joyride';

interface TourProps {
    run: boolean;
    onTourEnd: () => void;
}

const Tour: React.FC<TourProps> = ({ run, onTourEnd }) => {
    const steps: Step[] = [
        {
            target: '#file-explorer',
            content: 'This is the File Explorer. You can browse your project files and folders here.',
            placement: 'right',
        },
        {
            target: '#code-editor',
            content: 'This is the Code Editor. You can write and edit your code here.',
            placement: 'bottom',
        },
        {
            target: '#chat-panel',
            content: 'This is the AI Chat Panel. You can ask questions about your code, generate snippets, and more.',
            placement: 'left',
        },
        {
            target: '#terminal',
            content: 'This is the Terminal. You can run shell commands here.',
            placement: 'top',
        },
    ];

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={({ status }) => {
                if (status === 'finished' || status === 'skipped') {
                    onTourEnd();
                }
            }}
            styles={{
                options: {
                    primaryColor: '#8b5cf6', // purple-500
                    textColor: '#d4d4d4',
                    arrowColor: '#2d2d2d',
                    backgroundColor: '#2d2d2d',
                },
            }}
        />
    );
};

export default Tour;
