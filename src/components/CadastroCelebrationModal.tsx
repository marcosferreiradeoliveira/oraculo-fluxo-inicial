import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import {
  clearCadastroCelebrationPending,
  type CadastroCelebrationPayload,
} from '@/lib/cadastroCelebration';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  payload: CadastroCelebrationPayload | null;
  onClose: () => void;
};

export function CadastroCelebrationModal({ open, payload, onClose }: Props) {
  const navigate = useNavigate();

  const handleContinue = () => {
    const target = payload?.redirect || '/';
    clearCadastroCelebrationPending();
    onClose();
    if (target !== '/') {
      navigate(target);
    }
  };

  return (
    <>
      {open ? <CelebrationOverlay /> : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            clearCadastroCelebrationPending();
            onClose();
          }
        }}
      >
        <DialogContent className="z-[60] max-w-md border-2 border-oraculo-blue/20 text-center sm:rounded-2xl">
          <DialogHeader className="items-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple shadow-lg ring-4 ring-oraculo-purple/20">
              <CheckCircle2 className="h-9 w-9 text-white" aria-hidden />
            </div>
            <DialogTitle className="text-xl md:text-2xl">Conta criada com sucesso!</DialogTitle>
            <DialogDescription asChild>
              <div className="rounded-2xl border-2 border-oraculo-blue/20 bg-gradient-to-r from-oraculo-blue/10 to-oraculo-purple/10 p-5 text-base font-semibold leading-relaxed text-gray-800">
                Parabéns, você ganhou{' '}
                <span className="text-oraculo-purple">15 créditos</span> gratuitamente para testar a
                plataforma!
              </div>
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="w-full bg-gradient-to-r from-oraculo-blue to-oraculo-purple font-semibold text-white hover:opacity-90"
            onClick={handleContinue}
          >
            {payload?.redirect && payload.redirect !== '/'
              ? 'Continuar de onde parei'
              : 'Explorar o Oráculo'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
