import React, { useState, useEffect, useRef } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Send, Search, User, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Messages() {
  const { user } = useAuth();
  const [selectedContact, setSelectedContact] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  const isAdmin = user?.user_status === 'admin';
  const isAthlete = user?.user_status === 'athlete';

  // Charger les contacts (athlètes pour coach, coach pour athlète, tous pour admin)
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.email],
    queryFn: async () => {
      if (!user) return [];

      if (isAdmin) {
        // Pour les admins: charger tous les utilisateurs
        const allUsers = await base44.entities.User.list();
        return allUsers
          .filter(u => u.email !== user.email)
          .map(u => ({
            email: u.email,
            name: u.full_name,
            role: u.user_status || 'user'
          }));
      } else if (isCoach) {
        const coachView = localStorage.getItem('coachView') || 'club';
        const allClubs = await base44.entities.Club.list();
        const myClub = allClubs.find(c => (c.coach_emails || []).includes(user.email));

        let athleteEmails = [];
        const coachEmails = [];

        if (coachView === 'club' && myClub) {
          // Vue club : voir tous les athlètes et coachs du club
          athleteEmails = myClub.athlete_emails || [];
          (myClub.coach_emails || []).filter(e => e !== user.email).forEach(e => coachEmails.push(e));
        } else {
          // Vue individuelle : uniquement les athlètes des groupes personnels
          const groups = await base44.entities.Group.list();
          const myGroups = groups.filter(g => g.coach_email === user.email);
          athleteEmails = [...new Set(myGroups.flatMap(g => g.athlete_emails || []))];
        }

        const allUsersData = await base44.entities.User.list();
        const contacts = [];

        athleteEmails.forEach(email => {
          const u = allUsersData.find(u => u.email === email);
          contacts.push({ email, name: u?.full_name || email, role: 'athlete' });
        });

        coachEmails.forEach(email => {
          const u = allUsersData.find(u => u.email === email);
          contacts.push({ email, name: u?.full_name || email, role: u?.user_status || 'coach' });
        });

        return contacts;
      } else if (isAthlete) {
        const contactsList = [];

        // Trouver l'admin réel dans la base
        const allUsers = await base44.entities.User.list();
        const adminUser = allUsers.find(u => u.user_status === 'admin');
        const adminEmail = adminUser?.email || null;
        if (adminEmail) {
          contactsList.push({
            email: adminEmail,
            name: adminUser.full_name || 'Admin',
            role: 'admin'
          });
        }

        // Trouver l'entraîneur à partir du groupe
        const groups = await base44.entities.Group.list();
        const myGroup = groups.find(g => g.athlete_emails?.includes(user.email));
        if (myGroup) {
          const coachUser = allUsers.find(u => u.email === myGroup.coach_email);
          contactsList.push({
            email: myGroup.coach_email,
            name: coachUser?.full_name || myGroup.coach_email.split('@')[0],
            role: 'coach'
          });
        }

        // Récupérer tous les messages de l'athlète pour trouver d'autres contacts
        const allAthleteMessages = await base44.entities.Message.list('-created_date', 500);
        const userMessages = allAthleteMessages.filter(msg =>
          msg.sender_email === user.email || msg.recipient_email === user.email
        );

        const uniqueContactEmails = new Set();
        userMessages.forEach(msg => {
          if (msg.sender_email !== user.email && msg.sender_email !== adminEmail && msg.sender_email !== myGroup?.coach_email) {
            uniqueContactEmails.add(msg.sender_email);
          }
          if (msg.recipient_email !== user.email && msg.recipient_email !== adminEmail && msg.recipient_email !== myGroup?.coach_email) {
            uniqueContactEmails.add(msg.recipient_email);
          }
        });

        for (const email of uniqueContactEmails) {
          contactsList.push({
            email: email,
            name: email.split('@')[0],
            role: 'user'
          });
        }

        // Supprimer les doublons
        const finalContacts = [];
        const seenEmails = new Set();
        contactsList.forEach(contact => {
          if (!seenEmails.has(contact.email)) {
            finalContacts.push(contact);
            seenEmails.add(contact.email);
          }
        });
        
        // S'assurer que l'admin reste en premier
        finalContacts.sort((a, b) => {
          if (a.role === 'admin') return -1;
          if (b.role === 'admin') return 1;
          return 0;
        });

        return finalContacts;
      }
      return [];
    },
    enabled: !!user
  });

  // Charger les messages avec le contact sélectionné
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', user?.email, selectedContact?.email],
    queryFn: async () => {
      if (!selectedContact) return [];
      const allMessages = await base44.entities.Message.list('-created_date', 500);
      return allMessages.filter(msg =>
        (msg.sender_email === user.email && msg.recipient_email === selectedContact.email) ||
        (msg.sender_email === selectedContact.email && msg.recipient_email === user.email)
      ).reverse();
    },
    enabled: !!user && !!selectedContact
  });

  // Charger les messages pour afficher le dernier de chaque contact
  const { data: allMessages = [] } = useQuery({
    queryKey: ['all-messages', user?.email],
    queryFn: async () => {
      if (!user) return [];
      const messages = await base44.entities.Message.list('-created_date', 500);
      return messages.filter(msg =>
        msg.sender_email === user.email || msg.recipient_email === user.email
      );
    },
    enabled: !!user
  });

  // Mutation pour envoyer un message
  const sendMessageMutation = useMutation({
    mutationFn: (content) => base44.entities.Message.create({
      sender_email: user.email,
      recipient_email: selectedContact.email,
      content,
      is_read: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setMessageContent('');
    },
  });

  // Marquer les messages comme lus
  useEffect(() => {
    if (messages.length > 0 && selectedContact) {
      messages.forEach(msg => {
        if (msg.recipient_email === user.email && !msg.is_read) {
          base44.entities.Message.update(msg.id, { is_read: true });
        }
      });
    }
  }, [messages, user, selectedContact]);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Souscription temps réel
  useEffect(() => {
    if (!selectedContact) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create') {
        const msg = event.data;
        if (
          (msg.sender_email === user.email && msg.recipient_email === selectedContact.email) ||
          (msg.sender_email === selectedContact.email && msg.recipient_email === user.email)
        ) {
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['all-messages'] });
        }
      }
    });

    return unsubscribe;
  }, [selectedContact, user, queryClient]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageContent.trim() && selectedContact) {
      sendMessageMutation.mutate(messageContent.trim());
    }
  };

  const getLastMessage = (contact) => {
    const contactMessages = allMessages.filter(msg =>
      (msg.sender_email === contact.email || msg.recipient_email === contact.email)
    );
    return contactMessages[contactMessages.length - 1];
  };

  const getUnreadCount = (contact) => {
    return allMessages.filter(msg =>
      msg.sender_email === contact.email &&
      msg.recipient_email === user.email &&
      !msg.is_read
    ).length;
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Liste des contacts */}
          <Card className="lg:col-span-1 flex flex-col bg-white/80 backdrop-blur-lg border-slate-200 shadow-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {contacts.length === 0 ? (
                    <p>Aucun contact disponible</p>
                  ) : (
                    <p>Aucun résultat</p>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const lastMessage = getLastMessage(contact);
                  const unreadCount = getUnreadCount(contact);
                  const isSelected = selectedContact?.email === contact.email;

                  return (
                    <button
                      key={contact.email}
                      onClick={() => setSelectedContact(contact)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50/80 transition-all border-b border-slate-100 ${
                        isSelected ? 'bg-slate-100/70' : ''
                      }`}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-sm">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold text-slate-800 truncate">
                              {contact.name}
                            </h3>
                            {isAdmin && (
                              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                contact.role === 'admin' ? 'bg-amber-100 text-amber-700' :
                                contact.role === 'coach_pro' ? 'bg-purple-100 text-purple-700' :
                                contact.role === 'coach' ? 'bg-slate-100 text-slate-700' :
                                contact.role === 'athlete' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {contact.role === 'admin' ? 'Admin' :
                                 contact.role === 'coach_pro' ? 'Coach Pro' :
                                 contact.role === 'coach' ? 'Coach' :
                                 contact.role === 'athlete' ? 'Athlète' : 'User'}
                              </span>
                            )}
                          </div>
                          {lastMessage && (
                            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                              {format(new Date(lastMessage.created_date), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-500 truncate">
                            {lastMessage ? (
                              <>
                                {lastMessage.sender_email === user.email && '✓ '}
                                {lastMessage.content}
                              </>
                            ) : (
                              'Aucun message'
                            )}
                          </p>
                          {unreadCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {/* Zone de conversation */}
          <Card className="lg:col-span-2 flex flex-col bg-white/80 backdrop-blur-lg border-slate-200 shadow-lg">
            {selectedContact ? (
              <>
                {/* En-tête */}
                <div className="p-6 border-b border-slate-200 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-white">
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-white font-semibold shadow-sm">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{selectedContact.name}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedContact.role === 'admin' ? 'Administrateur' :
                       selectedContact.role === 'coach_pro' ? 'Entraîneur Pro' :
                       selectedContact.role === 'coach' ? 'Entraîneur' :
                       selectedContact.role === 'athlete' ? 'Athlète' : 'Utilisateur'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50/50 to-white/50">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-slate-500">
                        <User className="w-16 h-16 mx-auto mb-3 opacity-30" />
                        <p>Aucun message avec {selectedContact.name}</p>
                        <p className="text-sm mt-1">Commencez la conversation</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => {
                        const isSentByMe = msg.sender_email === user.email;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-xl px-4 py-2.5 shadow-md ${
                                isSentByMe
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-white text-slate-800 border border-slate-100'
                              }`}
                            >
                              <p className="text-sm break-words">{msg.content}</p>
                              <div className={`flex items-center justify-end gap-1 mt-1`}>
                                <span className={`text-xs ${isSentByMe ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {format(new Date(msg.created_date), 'HH:mm')}
                                </span>
                                {isSentByMe && (
                                  msg.is_read ? (
                                    <CheckCheck className="w-3 h-3 text-slate-300" />
                                  ) : (
                                    <Check className="w-3 h-3 text-slate-400" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-6 border-t border-slate-200 bg-white">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <Input
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder="Tapez votre message..."
                      className="flex-1 bg-white border-slate-200 focus:border-slate-800"
                    />
                    <Button 
                      type="submit" 
                      disabled={!messageContent.trim()}
                      className="bg-slate-800 hover:bg-slate-700 shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <User className="w-20 h-20 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Sélectionnez un contact pour commencer</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}