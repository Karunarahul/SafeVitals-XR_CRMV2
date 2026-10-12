"use client"

import * as React from "react"
import { Settings, Building, Globe, Mail } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { toast } from "sonner"
import apiClient from "@/lib/apiClient"

export default function SettingsPage() {
  const [companyName, setCompanyName] = React.useState("SafeVitals XR")
  const [contactEmail, setContactEmail] = React.useState("admin@safevitals.com")
  const [timezone, setTimezone] = React.useState("IST")
  const [currency, setCurrency] = React.useState("INR")
  const [senderName, setSenderName] = React.useState("SafeVitals HR")
  const [replyToEmail, setReplyToEmail] = React.useState("hr@safevitals.com")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiClient.get('/organization')
        if (res.data) {
          const d = res.data.data || res.data
          if (d.companyName) setCompanyName(d.companyName)
          if (d.contactEmail) setContactEmail(d.contactEmail)
          if (d.timezone) setTimezone(d.timezone)
          if (d.currency) setCurrency(d.currency)
          if (d.senderName) setSenderName(d.senderName)
          if (d.replyToEmail) setReplyToEmail(d.replyToEmail)
        }
      } catch (err) {
        console.error("Failed to load organization settings from API:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await apiClient.put('/organization', {
        companyName: companyName.trim(),
        contactEmail: contactEmail.trim(),
        timezone,
        currency,
        senderName: senderName.trim(),
        replyToEmail: replyToEmail.trim(),
      })
      toast.success("Settings saved successfully")
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save settings"
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 max-w-4xl mx-auto w-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Global Settings</h2>
        <p className="text-muted-foreground mt-1">Configure system-wide preferences and integrations.</p>
      </div>

      <form onSubmit={handleSave} className="grid gap-6">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5 text-primary" /> Organization Details</CardTitle>
            <CardDescription>Basic information about your company.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Company Name</Label>
              <Input 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
                className="bg-zinc-900 border-zinc-800" 
              />
            </div>
            <div className="grid gap-2">
              <Label>Contact Email</Label>
              <Input 
                value={contactEmail} 
                onChange={(e) => setContactEmail(e.target.value)} 
                type="email" 
                className="bg-zinc-900 border-zinc-800" 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Localization</CardTitle>
            <CardDescription>Configure timezone and currency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <select 
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="IST">Indian Standard Time (IST)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="PST">Pacific Standard Time (PST)</option>
                <option value="EST">Eastern Standard Time (EST)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="INR">Indian Rupee (₹)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-blue-500" /> Email Notifications</CardTitle>
            <CardDescription>Configure system email templates and sender addresses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Sender Name</Label>
              <Input 
                value={senderName} 
                onChange={(e) => setSenderName(e.target.value)} 
                className="bg-zinc-900 border-zinc-800" 
              />
            </div>
            <div className="grid gap-2">
              <Label>Reply-To Email</Label>
              <Input 
                value={replyToEmail} 
                onChange={(e) => setReplyToEmail(e.target.value)} 
                type="email" 
                className="bg-zinc-900 border-zinc-800" 
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
