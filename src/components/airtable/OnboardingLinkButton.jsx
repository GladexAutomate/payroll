import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check, Copy, ExternalLink } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function OnboardingLinkButton() {
  const [copied, setCopied] = useState(false);
  const onboardUrl = `${window.location.origin}/onboard`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(onboardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this onboarding link:', onboardUrl);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Link2 className="w-4 h-4 mr-1.5" /> Onboarding Link
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyLink}>
          {copied ? <Check className="w-4 h-4 mr-2 text-success" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Link copied!' : 'Copy link'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(onboardUrl, '_blank')}>
          <ExternalLink className="w-4 h-4 mr-2" /> Open form
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}