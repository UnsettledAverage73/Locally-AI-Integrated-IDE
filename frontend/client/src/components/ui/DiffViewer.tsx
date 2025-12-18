import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css'; // Default styles for react-diff-view

interface DiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (newContent: string, filePath: string) => void;
  diffContent: string;
  filePath: string;
  proposedContent: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ isOpen, onClose, onAccept, diffContent, filePath, proposedContent }) => {
  const files = parseDiff(diffContent);

  if (!isOpen || files.length === 0) {
    return null;
  }

  // Assuming a single file diff for simplicity
  const file = files[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Proposed Changes to {filePath.split('/').pop()}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[70vh] p-6 pt-0">
          <Diff viewType="unified" diffType={file.type} hunks={file.hunks} oldSource={file.oldSource} newSource={file.newSource}>
            {(hunks) =>
              hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
            }
          </Diff>
        </div>
        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAccept(proposedContent, filePath)}>Accept Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
