"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { MobileHeader } from "@/components/ui/mobile-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Logo from "@/components/ui/logo"
import { BetaModal } from "@/components/ui/beta-modal"
import { Mail, Phone, MapPin, Send, MessageCircle, HelpCircle, Shield, CreditCard, Clock, CheckCircle, XCircle, Loader2, Facebook, Twitter, Instagram } from "lucide-react"
import { useRecaptcha } from "@/hooks/use-recaptcha"

// FAQ data
const faqQuestions = [
  {
    question: "How does the fake product detection work?",
    answer: "Our system uses advanced AI to compare your product images with NAFDAC's official counterfeit database. We analyze every angle and detail to verify authenticity with over 95% accuracy."
  },
  {
    question: "How many scans can I do per day?",
    answer: "Free users receive 5 scans per day. You can purchase additional points to increase your daily limit. Points reset every 24 hours."
  },
  {
    question: "How do I detect substandard and falsified (SF) medical products such as anti-malarial and antibiotic medicines?",
    answer: "By using Mobile Authentication Service (MAS), users are to scratch codes on medicine and send the pin for free using Short Messaging Service (SMS) to 38351 or 38353 or 38120 or 20966 or 1393. Read more: https://nafdac.gov.ng/our-services/pharmacovigilance-post-market-surveillance/mobile-authentication-service-mas/"
  },
  {
    question: "Is the NAFDAC database always up to date?",
    answer: "Yes! We continuously update our database with the latest counterfeit alerts and safety information from NAFDAC's official sources."
  },
  {
    question: "What if I find a counterfeit product?",
    answer: "If we detect a counterfeit product, you'll receive a detailed report with safety recommendations. We also forward this information to NAFDAC automatically."
  },
  {
    question: "How secure is my personal information?",
    answer: "We use industry-standard encryption and never share your personal data. Your images and information are used only for verification purposes and are automatically deleted after processing."
  },
  {
    question: "Can I use this for business purposes?",
    answer: "Yes! We offer business accounts with higher scan limits, priority processing, and dedicated support. Contact us for business partnership details."
  }
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

  // Load reCAPTCHA script dynamically
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY_PLACEHOLDER

    // Load reCAPTCHA script dynamically
    if (siteKey && typeof document !== 'undefined') {
      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  // reCAPTCHA hook
  const { executeRecaptcha } = useRecaptcha()

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsBetaModalOpen(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // Execute invisible reCAPTCHA
      const recaptchaToken = await executeRecaptcha()

      if (!recaptchaToken) {
        setSubmitStatus('error')
        return
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken
        })
      })

      if (response.ok) {
        setSubmitStatus('success')
        setFormData({ name: '', email: '', phone: '', message: '' })
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      console.error('Contact form submission error:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Mobile Hamburger Menu Header with Google Profile Avatar */}
      <MobileHeader showBackToHome={true} />

      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 gradient-text">
              Contact Us
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 md:mb-12 max-w-2xl mx-auto">
              Get in touch with our team. We're here to help you stay safe and informed about product authenticity.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-8 sm:py-12 md:py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            {/* Contact Form */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <MessageCircle className="w-6 h-6" />
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                      placeholder="+234 XXX XXX XXXX"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-sm sm:text-base"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  {submitStatus === 'success' && (
                    <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 text-sm">Message sent successfully! We'll get back to you soon.</span>
                    </div>
                  )}

                  {submitStatus === 'error' && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-800 text-sm">Failed to send message. Please try again.</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-3 px-6 text-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-6">
              {/* Contact Info Cards */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Email Support</h3>
                      <p className="text-gray-600 text-sm mb-1">For general inquiries</p>
                      <a href="mailto:sampidia0@gmail.com" className="text-blue-600 hover:text-blue-800 font-medium">
                        sampidia0@gmail.com
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Response Time</h3>
                      <p className="text-gray-600 text-sm mb-1">We typically respond within</p>
                      <p className="font-medium text-green-600">24-48 hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Safe & Secure</h3>
                      <p className="text-gray-600 text-sm mb-1">Your information is</p>
                      <p className="font-medium text-purple-600">100% Protected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Follow Us</h3>
                  <div className="flex items-center gap-4">
                    <a href="https://www.facebook.com/share/1K8Xn4efku/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                      <Facebook className="w-6 h-6" />
                    </a>
                    <a href="https://mobile.x.com/detect1fake" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                      <Twitter className="w-6 h-6" />
                    </a>
                    <a href="https://www.instagram.com/detect1fake?igsh=cTVpNXVoc2FwcnQw" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors">
                      <Instagram className="w-6 h-6" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 gradient-text">Frequently Asked Questions</h2>
            <p className="text-lg text-gray-600">Find answers to common questions about our fake product detection service</p>
          </div>

          <div className="space-y-4">
            {faqQuestions.map((faq, index) => (
              <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-semibold text-md pr-4">{faq.question}</span>
                    <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${expandedFaq === index ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedFaq === index && (
                    <div className="px-6 pb-4">
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4 sm:py-6 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
            {/* Left Section: Logo and Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo />
              <span className="text-sm sm:text-base font-bold text-white">Fake Detector</span>
            </div>

            {/* Center Section: Download Badges */}
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={handleDownloadClick}
                className="transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                <img
                  src="/Google%20play.png"
                  alt="Join Beta Program - Android"
                  className="h-16 sm:h-20 w-auto hover:opacity-90"
                />
              </button>

              <button
                onClick={handleDownloadClick}
                className="transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                <img
                  src="/App%20Store.png"
                  alt="Join Beta Program - iOS"
                  className="h-16 sm:h-20 w-auto hover:opacity-90"
                />
              </button>
            </div>

            {/* Right Section: Database Info */}
            <div className="text-xs sm:text-sm text-gray-400 text-center lg:text-right">
              Utilize <strong className="text-blue-400">NAFDAC</strong> Official Database
            </div>
          </div>
        </div>
      </footer>

      {/* Beta Program Modal */}
      <BetaModal
        isOpen={isBetaModalOpen}
        onClose={() => setIsBetaModalOpen(false)}
      />
    </div>
  )
}
