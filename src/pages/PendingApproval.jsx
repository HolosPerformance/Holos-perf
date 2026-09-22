import { supabase as base44 } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader>
          <img
            src="/logo.png"
            alt="Logo"
            className="block w-20 h-20 object-contain mx-auto mb-2"
          />
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Compte en attente de validation</CardTitle>
          <CardDescription className="text-base mt-2">
            Votre compte a bien été créé. Un administrateur doit valider votre accès avant que vous puissiez utiliser l'application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Vous serez notifié dès que votre compte sera approuvé. En attendant, vous pouvez contacter votre administrateur.
          </p>
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => base44.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}