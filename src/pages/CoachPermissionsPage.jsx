import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, User, BarChart2, Activity, BookOpen, Users, UserCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function CoachPermissionsPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState({
    can_access_subjective_data_page: true,
    can_access_objective_data_page: true,
    can_edit_assigned_questionnaires: true,
    can_access_club_view: false,
    can_access_individual_view: true,
  });

  useEffect(() => {
    if (!currentUser) return;
    if (!isAdmin) {
      navigate(createPageUrl('AdminHome'));
      return;
    }
    const loadCoach = async () => {
      const params = new URLSearchParams(window.location.search);
      const coachId = params.get('coachId');
      if (!coachId) {
        navigate(createPageUrl('UserManagement'));
        return;
      }
      const allUsers = await base44.entities.User.list();
      const found = allUsers.find(u => u.id === coachId);
      if (!found) {
        toast.error('Entraîneur introuvable');
        navigate(createPageUrl('UserManagement'));
        return;
      }
      setCoach(found);
      setPermissions({
        can_access_subjective_data_page: found.can_access_subjective_data_page !== false,
        can_access_objective_data_page: found.can_access_objective_data_page !== false,
        can_edit_assigned_questionnaires: found.can_edit_assigned_questionnaires !== false,
        can_access_club_view: found.can_access_club_view === true,
        can_access_individual_view: found.can_access_individual_view !== false,
      });
      setLoading(false);
    };
    loadCoach();
  }, [currentUser, isAdmin, navigate]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(coach.id, permissions);
    toast.success('Permissions mises à jour');
    setSaving(false);
  };

  const statusLabel = {
    coach: 'Entraîneur',
    coach_pro: 'Entraîneur Pro',
    admin: 'Administrateur',
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('UserManagement')}>
            <Button variant="outline" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{coach?.full_name}</h1>
              <p className="text-slate-500 text-sm">{coach?.email}</p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {statusLabel[coach?.user_status] || coach?.user_status}
            </Badge>
          </div>
        </div>

        {/* Permissions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Gestion des accès et autorisations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Accès données subjectives */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Accès aux données subjectives
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permet d'accéder au dashboard de suivi des questionnaires et indicateurs psychométriques des athlètes.
                  </p>
                </div>
              </div>
              <Switch
                checked={permissions.can_access_subjective_data_page}
                onCheckedChange={(val) => setPermissions(p => ({ ...p, can_access_subjective_data_page: val }))}
              />
            </div>

            {/* Accès données objectives */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Accès aux données objectives
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permet d'accéder au dashboard des données Strava (distance, vitesse, fréquence cardiaque...).
                  </p>
                </div>
              </div>
              <Switch
                checked={permissions.can_access_objective_data_page}
                onCheckedChange={(val) => setPermissions(p => ({ ...p, can_access_objective_data_page: val }))}
              />
            </div>

            {/* Modifier questionnaires */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Modification des questionnaires
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permet à l'entraîneur de modifier les questionnaires qui lui sont assignés.
                  </p>
                </div>
              </div>
              <Switch
                checked={permissions.can_edit_assigned_questionnaires}
                onCheckedChange={(val) => setPermissions(p => ({ ...p, can_edit_assigned_questionnaires: val }))}
              />
            </div>

            {/* Accès vue Club */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Accès à la vue Club
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permet d'accéder au tableau de bord de gestion de club.
                  </p>
                </div>
              </div>
              <Switch
                checked={permissions.can_access_club_view}
                onCheckedChange={(val) => {
                  if (!val && !permissions.can_access_individual_view) return;
                  setPermissions(p => ({ ...p, can_access_club_view: val }));
                }}
              />
            </div>

            {/* Accès vue Athlètes individuels */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Accès à la vue Athlètes individuels
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permet d'accéder au tableau de bord de suivi des athlètes individuels.
                  </p>
                </div>
              </div>
              <Switch
                checked={permissions.can_access_individual_view}
                onCheckedChange={(val) => {
                  if (!val && !permissions.can_access_club_view) return;
                  setPermissions(p => ({ ...p, can_access_individual_view: val }));
                }}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
              {saving ? 'Enregistrement...' : 'Enregistrer les permissions'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}