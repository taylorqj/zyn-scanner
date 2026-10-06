import { HelpCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface UntrustedHostScan {
  text: string;
  host: string;
  code: string;
}

interface UntrustedHostPromptProps {
  scan: UntrustedHostScan;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Asks before treating a QR code that points outside zyn.com as a Zyn can. */
export function UntrustedHostPrompt({ scan, onConfirm, onDismiss }: UntrustedHostPromptProps) {
  return (
    <Alert role="alertdialog" aria-label="Unfamiliar QR code" className="animate-in fade-in border-info/40 bg-info/8 [&>svg]:text-info">
      <HelpCircleIcon />
      <AlertTitle>Is this a Zyn can?</AlertTitle>
      <AlertDescription>
        <p>
          That QR code links to <span className="font-mono">{scan.host}</span>, not zyn.com. It
          carries the code <span className="font-mono">{scan.code}</span>.
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={onConfirm}>
            Yes, redeem it
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Ignore
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
