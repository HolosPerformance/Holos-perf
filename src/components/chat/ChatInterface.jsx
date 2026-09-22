import React, { useState, useEffect, useRef } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ChatInterface({ currentUser, adminEmail = null }) {
  const [messageContent, setMessageContent] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Déterminer l'email de l'interlocuteur
  const isAdmin = currentUser.role === 'admin';
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState(adminEmail);

  // Charger les messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', currentUser.email, selectedAthleteEmail],
    queryFn: async () => {
      const allMessages = await base44.entities.Message.list('-created_date', 500);
      return allMessages.filter(msg => 
        (msg.sender_email === currentUser.email && msg.recipient_email === selectedAthleteEmail) ||
        (msg.sender_email === selectedAthleteEmail && msg.recipient_email === currentUser.email)
      ).reverse();
    },
    enabled: !!selectedAthleteEmail,
  });

  // Si admin, charger la liste des athlètes avec qui il y a eu des conversations
  const { data: athletes = [] } = useQuery({
    queryKey: ['chat-athletes'],
    queryFn: async () => {
      if (!isAdmin) return [];
      try {
        const allMessages = await base44.entities.Message.list('-created_date', 500);
        const athleteEmails = new Set();
        allMessages.forEach(msg => {
          if (msg.sender_email !== currentUser.email) athleteEmails.add(msg.sender_email);
          if (msg.recipient_email !== currentUser.email) athleteEmails.add(msg.recipient_email);
        });
        const users = await base44.entities.User.list();
        return users.filter(u => athleteEmails.has(u.email) && u.role !== 'admin');
      } catch (error) {
        console.error('Error loading athletes:', error);
        return [];
      }
    },
    enabled: isAdmin,
  });

  // Mutation pour envoyer un message
  const sendMessageMutation = useMutation({
    mutationFn: (content) => base44.entities.Message.create({
      sender_email: currentUser.email,
      recipient_email: selectedAthleteEmail,
      content,
      is_read: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setMessageContent('');
    },
  });

  // Marquer les messages comme lus
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach(msg => {
        if (msg.recipient_email === currentUser.email && !msg.is_read) {
          base44.entities.Message.update(msg.id, { is_read: true });
        }
      });
    }
  }, [messages, currentUser.email]);

  // Scroll automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Souscription temps réel
  useEffect(() => {
    if (!selectedAthleteEmail) return;
    
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create') {
        const msg = event.data;
        if (
          (msg.sender_email === currentUser.email && msg.recipient_email === selectedAthleteEmail) ||
          (msg.sender_email === selectedAthleteEmail && msg.recipient_email === currentUser.email)
        ) {
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
      }
    });

    return unsubscribe;
  }, [selectedAthleteEmail, currentUser.email, queryClient]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageContent.trim() && selectedAthleteEmail) {
      sendMessageMutation.mutate(messageContent.trim());
    }
  };

  // Si pas d'admin email défini (pour athlète), obtenir l'email admin
  useEffect(() => {
    if (!isAdmin) {
      if (adminEmail) {
        setSelectedAthleteEmail(adminEmail);
      } else {
        // Récupérer l'email admin depuis les messages existants ou les logs
        const findAdmin = async () => {
          try {
            // Essayer de trouver l'admin via les messages
            const messages = await base44.entities.Message.list('-created_date', 100);
            const adminMessage = messages.find(msg => 
              msg.sender_email !== currentUser.email || msg.recipient_email !== currentUser.email
            );
            if (adminMessage) {
              const foundAdminEmail = adminMessage.sender_email !== currentUser.email 
                ? adminMessage.sender_email 
                : adminMessage.recipient_email;
              setSelectedAthleteEmail(foundAdminEmail);
            } else {
              // Si aucun message, essayer de trouver via les TrainingLog (créés par l'admin potentiellement)
              const logs = await base44.entities.TrainingLog.list('-created_date', 10);
              if (logs.length > 0) {
                // Chercher un log qui n'est pas de l'utilisateur actuel
                const adminLog = logs.find(log => log.created_by !== currentUser.email);
                if (adminLog) {
                  setSelectedAthleteEmail(adminLog.created_by);
                } else {
                  // Par défaut, utiliser l'email du premier log (probablement un admin)
                  setSelectedAthleteEmail('admin@dlperformance.fr');
                }
              } else {
                // Email par défaut si rien n'est trouvé
                setSelectedAthleteEmail('admin@dlperformance.fr');
              }
            }
          } catch (err) {
            console.error('Error finding admin:', err);
            // En cas d'erreur, utiliser un email par défaut
            setSelectedAthleteEmail('admin@dlperformance.fr');
          }
        };
        findAdmin();
      }
    }
  }, [isAdmin, adminEmail, currentUser.email]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-slate-500">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          {isAdmin ? 'Messages avec les athlètes' : 'Contacter l\'équipe de DLPerformance'}
        </CardTitle>
        
        {isAdmin && athletes.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {athletes.map(athlete => (
              <Button
                key={athlete.email}
                size="sm"
                variant={selectedAthleteEmail === athlete.email ? 'default' : 'outline'}
                onClick={() => setSelectedAthleteEmail(athlete.email)}
              >
                {athlete.full_name}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Aucun message</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSentByMe = msg.sender_email === currentUser.email;
            return (
              <div
                key={msg.id}
                className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isSentByMe
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isSentByMe ? 'text-slate-300' : 'text-slate-500'}`}>
                    {format(new Date(msg.created_date), 'dd MMM HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Tapez votre message..."
            disabled={!selectedAthleteEmail}
          />
          <Button type="submit" disabled={!messageContent.trim() || !selectedAthleteEmail}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}