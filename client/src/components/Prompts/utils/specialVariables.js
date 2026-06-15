import { Calendar, User, Clock, Globe, Sparkles } from 'lucide-react';
export const specialVariableIcons = {
    current_date: Calendar,
    current_datetime: Clock,
    current_user: User,
    iso_datetime: Globe,
};
export const getSpecialVariableIcon = (name) => specialVariableIcons[name] ?? Sparkles;
