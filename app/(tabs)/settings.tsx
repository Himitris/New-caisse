import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useState } from 'react';
import { Store, Clock, DollarSign, Printer, Bell, Shield, CircleHelp as HelpCircle } from 'lucide-react-native';

interface Setting {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'action';
  value?: boolean;
  icon: any;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Setting[]>([
    {
      id: 'notifications',
      title: 'Push Notifications',
      description: 'Receive alerts for new orders and table status changes',
      type: 'toggle',
      value: true,
      icon: Bell,
    },
    {
      id: 'autoPrint',
      title: 'Auto-Print Receipts',
      description: 'Automatically print receipts when bills are paid',
      type: 'toggle',
      value: false,
      icon: Printer,
    },
    {
      id: 'restaurant',
      title: 'Restaurant Information',
      description: 'Update your restaurant details and contact information',
      type: 'action',
      icon: Store,
    },
    {
      id: 'hours',
      title: 'Operating Hours',
      description: 'Set your restaurant\'s operating hours',
      type: 'action',
      icon: Clock,
    },
    {
      id: 'payment',
      title: 'Payment Methods',
      description: 'Manage accepted payment methods and integrations',
      type: 'action',
      icon: DollarSign,
    },
    {
      id: 'security',
      title: 'Security Settings',
      description: 'Manage user permissions and access controls',
      type: 'action',
      icon: Shield,
    },
    {
      id: 'help',
      title: 'Help & Support',
      description: 'Get help with using the POS system',
      type: 'action',
      icon: HelpCircle,
    },
  ]);

  const toggleSetting = (id: string) => {
    setSettings(settings.map(setting =>
      setting.id === id ? { ...setting, value: !setting.value } : setting
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView>
        {settings.map(setting => {
          const Icon = setting.icon;
          return (
            <Pressable
              key={setting.id}
              style={styles.settingItem}
              onPress={() => {
                if (setting.type === 'toggle') {
                  toggleSetting(setting.id);
                }
              }}>
              <View style={styles.settingIcon}>
                <Icon size={24} color="#666" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingDescription}>{setting.description}</Text>
              </View>
              {setting.type === 'toggle' ? (
                <Switch
                  value={setting.value}
                  onValueChange={() => toggleSetting(setting.id)}
                  trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                />
              ) : (
                <Text style={styles.actionText}>Configure →</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  actionText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
});