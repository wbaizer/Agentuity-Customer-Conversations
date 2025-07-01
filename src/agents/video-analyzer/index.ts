import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { SpeechClient } from '@google-cloud/speech';
import Sentiment from 'sentiment';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import tmp from 'tmp';
import path from 'path';
import { writeFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';
import { Storage } from '@google-cloud/storage';
import type { google } from '@google-cloud/speech/build/protos/protos';
import ffmpeg, { type FfprobeStream } from 'fluent-ffmpeg';
import { InterviewMetadataSchema, InterviewSectionsSchema, type ExploratoryCustomerInterview, type InterviewMetadataSchemaType, type InterviewSections } from '../../types';
import { createInterview, getInterview, updateInterviewRecordingUrls, updateInterviewSections, updateInterviewTranscript } from '../../utils/kv-store';

const dev = true;
const compatibleFormats = ['audio/mp3', 'audio/wav', 'audio/ogg'];

// Use 'any' for untyped modules
const SentimentAny: any = Sentiment;

const auth = new GoogleAuth({
  apiKey: process.env.GOOGLE_API_KEY,
  keyFilename: process.env.GOOGLE_API_IAM_KEYFILE,
  projectId: 'customer-convos',
});

const speechClient = new SpeechClient({auth})

async function uploadToGoogleCloudStorage(filePath: string, bucketName: string, destination: string) {
  try {
    const storage = new Storage({
      projectId: 'customer-convos',
      keyFilename: process.env.GOOGLE_API_IAM_KEYFILE,
    });
    const response = await storage.bucket(bucketName).upload(filePath, {
      destination,
    });
    return `gs://${bucketName}/${destination}`;
  } catch (error) {
    console.error("Error uploading file:", error);
  }
}

function transcribeAudio(request: google.cloud.speech.v1.IRecognizeRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log("Starting long-running transcription...");

    dev ? resolve(`[00:00:00.000] - Will
I'll work through this computer. Okay, cool. Yeah. I just want to go back over what you said. You all are working with UiPath. The biggest question is whether or not something can be public-facing or not when it comes to this for the government. That's one of the bigger questions. I know that Agentuity has one customer that is currently a government customer in the state of Florida. It's stuff that can be foyed. I I believe it can be public-facing.

[00:00:33.900] - Dylan
Yeah. The other thing to keep in mind here as well is the states will have different requirements than the actual federal government as well.

[00:00:42.960] 
The states are going to be a little bit more lax. The government has some specific laws and rules that drive what they have to go meet.

[00:00:54.900] 
So essentially, I think...

[00:00:57.460] 
Okay, it's still gone. Okay, I thought it stopped for a second.

[00:00:59.660] 
Essentially, there's a series of controls that have been grouped together that's called FedRAMP. Yes, FedRAMP. Okay, cool. So the government, if it's on-prem, they have to meet all It becomes FedRAMP requirements.

[00:01:16.170] 
It becomes their requirement to ensure that the product has to do that. The government has to do that. Okay. Yeah, exactly. If it's not an on-premise solution and you're presenting your solution on the cloud, now it's on us as a group, right? The prime and the solution provider to be FedRAMP compliant.

[00:01:35.000] 
Now, more good news here as well. That is getting much easier. That process used to be a three-year process.

[00:01:41.100] 
They improved it. It was down to a year. There's a new version of that. That's that's supposed to be coming here shortly. The short version of that is if you can present your product in AWS Gov Cloud, you will check 95% of the boxes, and you guys just have to go back and do some other things.

[00:02:00.460] - Will
So-yeah, that's the current solution we have at one of my companies. We have Lockheed Martin, we use a GovCloud. We're not FedRamp compliant, but we do use govCloud, and that's enough for them.

[00:02:10.960] - Dylan
Yeah, exactly. Because it's their data. Yeah, and it's their data that they're presenting to you as well, which means they get to decide how it gets presented and stored, right? Now, if they were presenting customer data to you, their risk would be a little different.

[00:02:26.060] 
But you're absolutely on the right track, and that is the methodology that is pseudo-approved right now.

[00:02:33.460] 
It's like you can squeeze it through, but that's what's going to become official here shortly. So your experience with Lockheed right there is, I think, the best example there of your go-to-market is presenting a dovet cloud version of this product in a manner that... I don't know how much you have going on with Lockheed. You'll have two versions of the Lockheed guys in the program where they'll be like, Give me the software and leave me alone and don't talk to me again, or they'll be like, give me the software and hold my hand as I configure every little step of this all the way through. And both of those have their pros and cons, and you go from there.

[00:03:19.300] - Will
So another thing you said is the government is working fast in this area than any other revolution, the cloud, probably blockchain. The challenge is that there's billions of players, Microsoft Power automate platforms. It's giving away for free. Not really, but there's a consistency between the exec orders and the rules that in regs that are around AI and what AI can be used on government data.

[00:03:44.080] - Dylan
Yeah, let's talk about both of those real quick in a little more detail. Microsoft is not a very intelligent company. We've seen them do this in a lot of different places where essentially they are Especially in the government, customers giving away the paid versions of the licensing to avoid a customer bringing in another product that competes with it. For example, we do quite a lot with a company called PECSIP. You've probably never heard of it. It's a unified communications platform where it can take a Zoom call and a Teams call and put them all in the same call together. It's a cool thing. Very useful for the government because you have all kinds of despairing teams. You've got groups that use Zoom, you got groups that use Google Meet, everybody can come in and meet it from there. We had four different licenses of PECSIP that were well over a million dollars each, all in the DOD. Microsoft went in and gave away the premium team's license to the customer for free to get them to pull out PECSIP so they didn't have a competing. You're going to see that a lot starting here, like right now with Microsoft, They literally just released Copilot into GCC High in the last couple of weeks.

[00:05:06.030] 
Our company is in GCC High. I actually was on vacation the last few weeks. I spent most of this week playing with the AI features that we actually just got. That part of that competition pool is going to make this very difficult for you guys. But the flip side of that is Microsoft support sucks. Microsoft Microsoft training sucks. There's no documentation on automate, there's no documentation on GCCI, there's no documentation on the government DOD environment that this will all have to go into. If a Lockheed Martin was going to try to develop a Microsoft AI app for a government customer, they'd have to bring in so many expertise anyway. That your cost is going to be less because they're going to have to go find some super You're expert in Microsoft GCCI and Power automate, and another one in flows, and another one in Connections. You've got to bring in all these pieces that are very disparate in Microsoft, where in your case, you're owning that whole process from the connection all the way through.

[00:06:20.640] - Will
Yeah. Another thing you said is, well, something that would be my job if I joined, would be needing to find a use case that's repeatable and can be marketed and get customers. You all have a number of RFPs around this area?

[00:06:37.520] - Dylan
No. I mean, I'll be honest. A lot of what we see right now is very specific. So there's a bunch for the Salesforce bot just got a cloud approved.

[00:06:51.370] 
So now they're coming and buying that bot.

[00:06:54.520] 
So in theory, we could respond to something else other than that bot.

[00:06:58.630] 
You're like, well, yeah, you could buy that, but here's something else. But they're buying that Salesforce bot because they already have Salesforce, and they already have other workflows and other things, and they just want to plug that bot in.

[00:07:10.060] 
So it's not a great fit. We have not seen a lot of what I will call generic agent list requests. We've seen some. The bulk of what we're seeing right now is much more specific. I think Splunk just had a couple that they released as well. We've seen for those, ServiceNow has some. But yeah, the bulk of them are more, Hey, I already have this platform, and now I want to add this feature to my platform rather than a true agentless workflow and that thing. But they do pop up, and I do suspect that they will increase dramatically over the next 12 months just because of the push and the lack of resources. I'll use us as an example. I spent this week playing with AI, and In order to do this stuff, you need a Power automate admin, you need somebody who knows Power apps, you need a Dataverse admin.

[00:08:24.020] 
So even in our little company of 50 employees, I don't have the access to do all the things that I need to do. I got to pull in somebody else, and that somebody else has another job. So it's like if you were trying to develop us, there's a limited resources available, especially around these kinds of topics.

[00:08:43.330] 
It's not the same as a software hardware install where you can turn around and get one of 10 guys to rack and stack a server. Here, just go plug in the orange cables under the orange holes and go from there. There's a level of expertise here that just isn't widely available. I think this market is going to grow pretty dramatically in the next 12 months.

[00:09:11.880] - Will
Interesting. But you said it goes to what you're saying is the government really doesn't know what to ask for. So they're turning to these large system integrators, right? Like yourselves, like Lydus, Accenture, Dell, Lockheed, to do the work for them, right?

[00:09:37.580] - Dylan
And a lot of what we've seen, the IRS one, was they already had that contract. So they already had the contract to make the easy form easier. And they were spending millions developing this super complex website, right? And we came in and showed them how to do it with UiPath.

[00:10:00.000] 
I'll open another subcontractor, but how we could build a bot that basically did the back-end work that they were trying to build out on that website. Because what they were trying to do was build a website that had all of the things in all the tables, and instead, you just built a bot that said, Okay, if they say this, give them this options. Then it punched it in at the end rather than trying to build it all through a live HTML. Honestly, I I think if I were coming in, my first 12 months would be what programs... I would be going to the system integrators and saying, What programs do you have that would be beneficial for automation that would immediately save you costs. What about for the customer? Yeah, I mean, same idea. Like I said, I spent the week playing with it. I'm not even there yet, right? That's the fun part of what I figured out this week is I spent the week figuring out what questions I wanted to ask, and now I've got to figure out how to get the data in there to do the questions. But I didn't even know.

[00:11:20.860] 
I thought I knew what questions I wanted to ask. It was like, Oh, great. I got ChatGP and I got great prompts and everything else. I literally spent most of this week playing with it and trying to figure out exactly what we were trying to do and ask. Again, I think with your experience, you probably know that better than I do. Is even when a customer knows they want a bot, they or an agent.

[00:11:45.340] - Will
They don't even really know.

[00:11:47.620] - Dylan
Yeah, they really don't know.

[00:11:48.980] - Will
How to build it or really what use cases to build for themselves.

[00:11:53.100] - Dylan
Yeah. I would imagine across all three of the technologies you're working on, It ends up being the same thing is they have a current state, they have a problem, they have an ideal end state, but they have no idea how the three connect, right? Where you sell this is by saying, Here it is. Here's your golden ticket. The light bulb goes off and they go, Oh, yeah, that'd be cool. Great. Let's go from there.

[00:12:26.960] - Will
Really, until people really I have to understand maybe going through a third party that knows how to build these solutions for them. Because I don't think... I mean, Agentuity would probably be willing to go in and help you start off, but at a mass scale, probably going to a third party who knows how to build these for them.

[00:12:50.460] - Dylan
We've got some third party. We've got some subcontractors we use to do this stuff with UiPath, and we've done a couple with Blue Prism as well, and there's a couple of the smaller ones that we've done. We have a small group of subcontractors that have some experience in this as well from a design and everything else standpoint. With the idea here of this call of, is this something Will wants to do with his life or not? It's a really exciting area. My answer to you would be it's a risk. You could spend 12 months, you could have 20 amazing opportunities and have all 20 of them not even come close to getting funded in the next 12 months. To me, the biggest risk here right now, if I were you sitting in your shoes, is this sales cycle is going to be a 12 to 24 month sales cycle. It's just to be realistic with it.

[00:14:03.320] - Will
Even into you all or into a Lockheed or something?

[00:14:07.970] - Dylan
Yeah, into a Lockheed or a customer. With us, yeah, it would be that long only because of where we are in a data transition. We're about to roll out a new... We're trying to implement a new accounting program that will then bring in all of our data into there. That won't be going live until the end of the year. With that, then we've got to get all the implementations, everything else from there. For us, yeah, it's probably 12 months. But I would say even in the typical customer environment right now, unless something's on fire, broken, it's going to be a slow sale.

[00:14:43.460] - Will
Okay. Okay, interesting. I know we're over time.

[00:14:48.800] - Dylan
You're good. I thought we had an hour.

[00:14:51.020] - Will
Okay. Oh, yeah, we do. Okay, great.

[00:14:54.060] - Dylan
And I was late. It's fine.

[00:14:59.060] - Will
Well, cool. I know that this is a 12-month cycle. What would be something that would hack into basically bringing that down? Would it be just like, is there something that the product could have that you're like, Okay, we need this immediately? I think- Or it may be a month or two off. Like, Okay, they have SOC 3 or they have SOC 2 or something like that.

[00:15:30.000] - Dylan
I think you would need a very specific repeatable use case so that you could point to it with a repeatable cost as well, so that you could turn around to a customer and say, I can fix this problem for you tomorrow, and here's how much it's going to cost you, and make it as plug and play as possible, which in this market is challenging. I shouldn't say challenging. There's a With Microsoft doing all the no code application, which isn't really an accurate statement. I have now played with this for the week to know that as not a developer background, there's only so far you can get if you don't have a developer background. If you don't know JSON, I'm sorry, there's just only so far you're going to get, especially from an output standpoint. It really needs to be to a point where it is a clear, repeatable, this will fix this problem for you, and this is how much it should save you by fixing that problem. But The challenge here is everybody wants their own little special bot. They should because that's what makes it better. The generic bots don't work. That's the whole point.

[00:16:58.700] 
You've got to teach it, you got to get it to learn, you got to make it smarter by giving it your inherent knowledge in order to make it better at its shop.

[00:17:08.140] - Will
Yeah. Okay, that's interesting. A lot of it is about handling agents and handling the orchestration of agents and deploying that to the web, to the cloud. They have different services like agent gateways, object stores, key value, vector databases.

[00:17:31.440] - Dylan
It can do all the RPA stuff that UiPath can do as well, right? I'm assuming with document reading and OCR.

[00:17:39.040] - Will
Don't put me on that, but I would imagine.

[00:17:41.820] - Dylan
Okay. There's the other option, right? Uipath has stumbled since they went public, right? They actually have a pretty decent install base. The other way to shorten your time frame here would just to be turn around and go after UI path customers that are currently using the product, right? And say, Hey, yeah, you're using it, but they're having issues. We can come in and mimic your current environment. We'll copy your bots and put in how this way you guys will have more control over them. They'll be in your cloud environment because all the UiPath ones are on-prem as well. As people start to do hybrid or move their environments over, those bots won't really work in a cloud. That would be another way to maybe Maybe attack it and shorten the cycle. Flips are tough because if we sold the original package for a million bucks, the life of the yearly maintenance, 200K, which means if you're going to come in and replace it, you probably got to be around that 200K mark in order to make it worthwhile because if it ain't broke, don't fix it. The flips become a little It's challenging, but you guys are also a growth product, right?

[00:19:06.960] 
You fit in the area where nobody ever lowers your license, right? They just come back next year and buy more of the license. It could be a scenario where you buy into some customers to get in the door cheap, get the path performance, and then get them to come back next year and expand the environment, expand the bots, and stuff like that. That's what we did with UiPath, but then UiPath really struggled after they went public, and almost everybody that we worked with there left. Then when the new sales teams came in, we just didn't jive with them for whatever reason. We don't do much UiPath anymore.

[00:19:46.000] - Will
Interesting. Okay. What was a few necessary things that you would need to see from a product like Agentuity to start to bring it to basically productize to your agents more quickly?

[00:20:03.780] - Dylan
Yeah.

[00:20:05.120] - Will
For example, let me get your thing, and then if you're having trouble, I can give you some examples.

[00:20:10.520] - Dylan
No, yeah, go ahead. Start with some examples and we'll go from there.

[00:20:15.040] - Will
One thing that my immediate reinteraction was like, Okay, if it's multi-tenant, it needs to be FedRAMP. But are you looking more for something that's self-hosted? Are you looking for something that's more single-tenant to implement? Or are you cool with multi-tenant? If it has XYZ things, stuff like that?

[00:20:37.420] - Dylan
I would say without the FedRAMP, I would focus on non-CUI data because that's really the key marker of what triggers a FedRAMP requirement. So cui is controlled with unclassified information. I think that's the first place to start. And then trying to figure out an agent that would provide value to more than one agency on that data set.

[00:21:30.000] - Will
One of the benefits of this would probably be the ease of deploying the agents, the ease of monitoring those agents as well. You write all these agents, and now you have to spin up your own architecture and whatnot. You can use this and use self-hosted, potentially. I don't know if they have self-hosted yet, but that's something they're working on is a self-hosted architecture, a CI/CD tool. I don't know if you know C-I-C-D. It's just like self-hosted, like self-hosted runner. You're able to immediately push these agents out and have them have some infrastructure around them.

[00:22:25.640] - Dylan
Trying to see if I can find a somewhat recent one to I'll show you what they look like.

[00:22:38.500] - Will
For that, what would you need? I guess you're finding something that would answer that.

[00:22:44.520] - Dylan
Yeah. Can I do an attachment here? I can.

[00:23:25.880] 
Download it. Come on. This appears to be an actual new requirement. It's from May, but I think it would help for you to understand how we see some of these requirements when they get to us. This one is for a base in two-year options for UiPath. It's got two of the flex automation developers, the attended users, no orchestrator or anything else. It just has the automation on the attended user one. There's no real statement of work or anything else. It's just, Give me my licenses and leave me alone. Let me see if I can find a better one. But that's What's the bulk of what these look like when we see them? The challenge is going to be in a scenario like this. We could go to this customer and be like, Hey, we have another option. You want to look at it? In this particular scenario, this came out in May. They were looking at a July period of performance, so it would have been a very quick rate window to try to get that turned around and done. Let's see. What's this one?

[00:25:11.540] - Will
So these are RFPs?

[00:25:13.580] - Dylan
Yeah, these are all RFPs.

[00:25:17.760] - Will
I see.

[00:25:23.100] - Dylan
Trying to find one that actually has a statement of work associated to it so you can get an idea of the level of detail that we would in a scenario where it was truly new, and they were asking us to do something.

[00:25:42.480] - Will
Yeah. I think something It may also be you all being able to use it, too. There's an ask for some work automation, but I guess I need to see this RFP to understand what it looks like.

[00:25:59.540] - Dylan
Yeah, What you're talking about is us using it in performance of a contract, right? Yes. It's possible for sure.

[00:26:08.600] - Will
Then handing that off to the customer.

[00:26:10.760] - Dylan
Yeah, it's definitely possible. But right now, we don't have We don't have any of those. No, that's renewal, too. We don't have any of them that are active like that. It was like if we had just one or we were bidding on the patent and trademark office one, I referred to, that would have been a good opportunity to do so. But we don't have anything active that would fit into that right now. Man, these are all renewals.

[00:26:46.700] - Will
That you do an RFP for a renewal?

[00:26:53.960] - Dylan
Yeah. Interesting.

[00:26:58.240] - Will
Okay. When you're looking at using some of these newer tools, is there a certain checklist that you have to go through to be like, Okay, it has this, this, and this? We have the clear... We have the Is it clear to use it?

[00:27:19.580] - Dylan
Yes. With any of these, depending on where it's going to sit, they would need an authority to operate. That's what that's referred to, an ATO in the government. Fedramp gets you an automatic ATO, which is the other reason that everybody asks for FedRAMP. Okay. This one is a little bit- Is there any way to operate without that, about the FedRAMP? If the Customer will take on the risk.

[00:27:48.460] - Will
Interesting.

[00:27:50.400] - Dylan
This one's a little better. Let's see.

[00:28:05.800] - Will
But again, you can skip that if you let the customer host it on their own.

[00:28:11.420] - Dylan
Correct. Yeah.

[00:28:13.700] - Will
So let's say we It's something where you can use it online, but it's using your own infrastructure.

[00:28:20.300] - Dylan
This one's actually pretty good. This one works.

[00:28:24.300] - Will
Are you sending them to me through email?

[00:28:25.740] - Dylan
Oh, no, these are- Yeah, it's coming in right now. This one was a bigger file. So if you open that one up and scroll down to page 9, it starts telling you what you need to do.

[00:28:46.160] - Will
Was it the second one right here?

[00:28:47.580] - Dylan
Yeah, the bigger one. Yeah, the 3. 39 meg one.

[00:28:51.740] - Will
Okay. Page 9.

[00:28:55.880] - Dylan
Let me see. This is the start, right? This is about the transition in, and this is the things that they want to be able to do, right? This gets more and more detailed as you get into it. But then it starts talking about the licensing and what they need there. Then there's to professional services.

[00:29:26.120] - Will
I see. Okay. Interesting. All right.

[00:29:32.540] - Dylan
This is one right now. This is closed a while ago. I think this came out a couple of months ago. This is February. But this is one where we could have taken this to you guys and been like, Okay, let's make... Instead of responding with UiPath, Let's show them how we could respond with our solution and provide a price. But this is where knowing that they're asking for UiPath, we would have to really hammer showing how our response does the the same things as the UiPath automation suite and does a complete end-to-end integration. Really, actually, in that scenario, because they gave it to us, they don't always give it to us, is those desired outcomes is really what we would be focusing on. If you see... This goes back to what I was trying to explain. We either get a, Here, I want these number of licenses. I know I know exactly what I want. I know exactly what it looks like, or we get this, which is, Here's my list of desired outcomes, and give us a response. This one, for example, was open for six days. We would have had six days to be able to ingest all of this, understand it, and write a response.

[00:30:59.000] 
That was a request for information, so it wasn't really a quote, so it didn't need a super formal proposal. But this would have been tough to do in a week period of time to try to turn around and maybe not completely design, but get a base design and understanding of what they're looking for and turn around and give a written response to this requirement.

[00:31:23.520] - Will
Interesting. Okay.

[00:31:25.500] - Dylan
This honestly would be your best case scenario scenario of what an RFP would look like. If you went to the system integrators, it would look very similar to this. The only difference would be they would probably not have the UI path name in here at all, and they would just say, Hey, here's what I want. Can you do it? But this is actually a really good sample of what these requirements look like right now when we get them.

[00:31:54.700] - Will
You and other system integrators have a similar process to what the government does?

[00:32:00.000] - Dylan
Yeah, and different levels of maturity there based on the size of the company and the number of employees and everything else. The other thing I've been looking through here is I wanted to see what security requirements that are on here. They have personnel security requirements, they have some surveillance. It's actually a really good RFP. I mean, this thing 37 pages, but this is actually really well done. Most of them are not this good, just to be clear. This is a plus example.

[00:32:41.900] - Will
Right. Interesting. Okay.

[00:32:44.860] - Dylan
Updates. I don't see any security requirements in there, but it was also an RFI, so they may hold back the security requirements until it becomes an RFP. But But this would be a great opportunity because it's an RFI. Now they're asking for information, not asking to buy it. They're saying, Okay, this is what we think we want to do. This would be a great one where we would come back and say, If your guys' design method technology was different than UiPath. You'd want to point that out and why using what you were talking about before. The orchestration and deployments easier and really identifying that in part of this response and things like that. This is where we would be the most help working with you guys together is we would set up something where whenever we saw something like this, we would have our reps reach out to you guys and say, Hey, we saw this. Do you want to go work it? And go from there. Yeah. So this would be the best example, I think, of what you would get out of us.

[00:33:54.520] - Will
I know Lockheed Martin works with other customers who are not government. Do you all do that as well?

[00:33:59.380] - Dylan
Not really. No, not for us. We're so small. They don't want to give credit to anybody else. We're a very weird entity just because we're 50 employees, but we do 450 billion a year and owned by a husband and wife. Credit's a big thing. Government pays slow, but they always pay.

[00:34:20.180] - Will
Fair. Well, all right. I think that's the majority of the questions I have. The last two I have are, could I come back to you if I have more questions?

[00:34:30.780] - Dylan
Reach out? Of course. Yeah, of course.

[00:34:33.120] - Will
I guess I have three. The second one, second to last is, is there anybody else who you think I should talk to? Maybe not even in the LSI space or knows more about agents and maybe is trying to build them into their own workflow?

[00:34:52.500] - Dylan
To be honest, I think that's why I would tell you this is a good idea because there is no one in this industry who is an expert in this right now. If you can get yourself out in front as an expert and the challenges of trying to do AI and agentless workflows in a government environment Management, people will come flocking because there are no experts in this right now. It's a good and bad answer, right? If you're familiar with CMMC at all, the same thing happened when When they released that, there was 10 guys who read all 400 pages of it and really got it. Those guys all started their own companies, and those guys were all super rich now because they're the only 10 guys on the planet that actually can understand and regurgitate the information in a useful manner. That's the problem with this AI conversation. Everybody can get as deep as me. Nobody can get deeper than where I am. It's like you get to the, I get the agentless workflow. But when you really start talking about, Okay, how do you program this? How do you test it? How do you implement it?

[00:36:09.020] 
Especially in a government environment, there are no experts in this yet. Last example for you. Because we're in GCC high, it's such a weird environment. There's only four places you can buy those licenses. We're playing with Power automate, the AI prompts, and We went back to our license provider and said, Hey, is there anybody who does training on GCC high power on the Powerapps platform? He was like, No. There's just nothing there. There's no documentation from Microsoft. There's no public training because it's all just so new. There really is a huge opportunity here for a company or an individual or a group of companies to present themselves as a solutions expert in in this manner. Just be careful what you wish for.

[00:37:03.280] - Will
The issue also is you don't create. It's not like a no code agent creation. You build your own agent. So you still have the issue of, Hey, there's people who don't understand it, and they can just use the product. It's infrastructure is not going to create it for you.

[00:37:17.300] - Dylan
But that's a body problem. That one's easier to fill through subcontractors, through people. You can go find people, we can go find people. The body problems, honestly, are fixable. It's the There's just nobody who knows all the answers to that question. There's somebody who understands the security side of the requirement. There's somebody who understands the bot side of the requirement. There's somebody who understands the storage side and somebody understands the dataverse side. But there's nobody who understands all five of those things together and how they all interconnect and how to be presented. Interesting.

[00:37:55.900] - Will
Is there anybody else in your area of expertise that you could connect me with?

[00:38:02.100] - Dylan
Off the top of my head, no, but I'll think about it.

[00:38:04.600] - Will
No worries. Again, I appreciate the career advice earlier. This is an interesting area, and I think it's a really cool product. I'm obviously currently in stages of talking with them. But I just wanted to get your topic. I wanted to run you through a customer combo and get your thoughts on it.

[00:38:27.700] - Dylan
Yeah, you got other questions, feel free to reach out, send them over. If you want to do another call, happy to do that.

[00:38:34.180] - Will
I bet after listening to this, the founder is going to be like, Well, can we get on the call with them? But yeah.

[00:38:43.420] - Dylan
If I were in your shoes, I'd be scared and excited. It is a huge opportunity, but it's also a giant risk. I'm just blatantly honest. You could do amazing amazing and get great contacts and have all these great opportunities and not see a single dollar for two years. It's just- They're going to go beyond government.

[00:39:11.860] - Will
But for government, it's probably a long process, would be my guess.

[00:39:19.160] - Dylan
I think the system integrators would be the first entry point of the government. It's the easier entry point, and we can help the direct ones, like in what I just showed you there. But the Lockheeds and the Martens already have contracts where automation would help them, and that would lower their operating costs or put forth a better end product to the customer and lower their infrastructure costs as well.

[00:39:50.140] - Will
Yeah. Well, cool. I appreciate this, Dylan. If you need anything, I don't know how I could help, but I would be more than willing to.

[00:39:59.930] - Dylan
I appreciate you reaching out. Good to talk to you.

[00:40:03.110] - Will
Yeah. All right.

[00:40:04.390] - Dylan
Thank you. Take care. All right. Bye.

`) : speechClient.longRunningRecognize(request)
      .then(([operation]) => {
        console.log("Operation:", operation.name);
        return operation.promise();
      })
      .then(([response]) => {
        console.log("Response:", response);
        const transcript = response.results?.map((result: any) => result.alternatives[0].transcript).join('\n') || '';
        resolve(transcript);
      })
      .catch((error: any) => {
        console.error("Error during transcription:", error);
        reject(error);
      });
  });
}

async function authenticateImplicitWithAdc() {
  // This snippet demonstrates how to list buckets.
  // NOTE: Replace the client created below with the client required for your application.
  // Note that the credentials are not specified when constructing the client.
  // The client library finds your credentials using ADC.
  const storage = new Storage({
    projectId: 'customer-convos',
  });
  const [buckets] = await storage.getBuckets();
  console.log('Buckets:');

  for (const bucket of buckets) {
    console.log(`- ${bucket.name}`);
  }

  console.log('Listed all storage buckets.');
}

async function getAudioMetadata(videoPath: string): Promise<FfprobeStream> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } 
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      if (!audioStream) {
        reject(new Error('No audio stream found in the file.'));
        return;
      }
      resolve(audioStream);
    });
  });
}

async function downloadAudio(ctx: AgentContext, audioAttachment: any): Promise<{ videoName: string, videoPath: string }> {
  // Create a temporary directory
  const tmpDir = tmp.dirSync();
  const videoName = dev ? 'audio1081663035.mp3' : path.join(audioAttachment.filename + "-" + Date.now() + "-" + Math.random().toString(36).substring(2, 15));;
  const videoPath = dev ? 'src/tmp/audio1081663035.mp3' : path.join(tmpDir.name, videoName);

  // Determine if the audio format is compatible
  if (!dev && !compatibleFormats.includes(audioAttachment.contentType)) {
    // Convert the audio to a compatible format using ffmpeg
    ctx.logger.info("Converting audio file to mp3 format.");
    ffmpeg(audioAttachment.content)
      .toFormat('mp3')
      .on('error', error => console.log(`Encoding Error: ${error.message}`))
      .on('end', () => console.log('Audio Transcoding succeeded!'))
      .save(videoPath);
  } else {
    // Save the video file to the temporary directory
    !dev && ctx.logger.info("Downloading audio file to temporary directory.");
    !dev && writeFileSync(videoPath, audioAttachment.content, 'base64');
  }
  return { videoName, videoPath };
}

async function MetadataAgent(ctx: AgentContext, emailContent: string): Promise<ExploratoryCustomerInterview> {
  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: InterviewMetadataSchema,
    system: "You are an intelligent customer research assistant. Your role is to process emails containing information related to customer interviews and extract structured data for further product-market fit analysis.",
    prompt: `
      You will receive an email that includes context about a customer interview and one or more links to external content (such as a transcript, summary, or video). Your task is to:

      1. Identify and access all relevant links in the email.
      2. Extract the interview content from those sources (e.g. full transcript, summary, video transcript).
      3. Read and understand the material to prepare structured output suitable for deeper product analysis.

      For each customer interview, return:
      - Customer and Company Name
      - Customer and Company Information (through provided links)
      - Company Overview from LinkedIn Url
      - Interview Date
      - Interviewer Name(s) (if available)
      - LinkedIn URL
      - Company LinkedIn URL

      EMAIL CONTENT:
      ${emailContent}
    `
  });

  const interviewMetadata = result.object as InterviewMetadataSchemaType;

  return await createInterview(ctx, interviewMetadata);
}

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const email = await req.data.json();
    if (!dev && (!email || typeof email !== 'object' || !Array.isArray((email as any).attachments))) {
      return resp.text('Invalid email format or no attachments found.');
    }
    
    const audioAttachment = dev ? null : (email as any).attachments.find(
      (attachment: any) => attachment.contentType.startsWith('audio/')
    );

    const emailContent = dev || !email ? `
      Customer: Dylan Slay
      Company: Blue Tech
      Interview Date: 2025-06-27
      LinkedIn URL: https://www.linkedin.com/in/dylan-slay-3794913a/
      Company LinkedIn: https://www.linkedin.com/company/blue-tech/
      Company Overview: Blue Tech is a software company that provides technology solutions for the government.
      Customer title: Sales Manager
      Interviewer: Will Baizer
    ` : '';

    const interview = await MetadataAgent(ctx, emailContent);
    const interviewId = interview.id;

    if (!dev && !audioAttachment) {
      return resp.text('No audio attachment found.');
    }

    const { videoName, videoPath } = await downloadAudio(ctx, audioAttachment);

    const audioMetadata = await getAudioMetadata(videoPath);
    ctx.logger.info("Audio metadata:", audioMetadata);

    // Upload the audio file to Google Cloud Storage
    const bucketName = 'agentuity-customer-convos'; // Replace with your bucket name
    const destination = 'audio-files/' + videoName; // Replace with your desired destination path
    
    !dev && ctx.logger.info("Uploading audio file to Google Cloud Storage:", videoPath, bucketName, destination);
    const uri = dev ? 'gs://agentuity-customer-convos/audio-files/audio1081663035.mp3' : await uploadToGoogleCloudStorage(videoPath, bucketName, destination);
    ctx.logger.info("Audio file uploaded to Google Cloud Storage:", uri);

    await updateInterviewRecordingUrls(ctx, interviewId, uri, videoPath);
    
    // Use the URI in the Speech-to-Text API request
    const request: google.cloud.speech.v1.IRecognizeRequest = {
      audio: {
        uri,
      },
      config: {
        encoding: audioMetadata.codec_name as any,
        sampleRateHertz: audioMetadata.sample_rate,
        languageCode: 'en-US',
      },
    };

    ctx.logger.info("Extracting transcript from audio file.");
    const transcript = await transcribeAudio(request)// Use the implemented transcribeVideo function
    await updateInterviewTranscript(ctx, interviewId, transcript);

    ctx.logger.info("Extracting sentiment from transcript.");
    const sentiment = new SentimentAny();
    const moodScores = sentiment.analyze(transcript);

    ctx.logger.info("Moodscores:", moodScores);
    ctx.logger.info("Extracting transcript segments for analysis.");

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: InterviewSectionsSchema,
      system: "You are a research analyst assistant helping a product team evaluate product-market fit by preparing structured summaries of customer interviews.",
      prompt: `
        Given the following transcript from a customer interview, break it down into structured, labeled sections that another agent can analyze for product-market fit signals.

        TASK:
        - Group related parts of the conversation into clear sections based on topic.
        - Provide a description of the section.
        - Provide potential takeaways from the section.
        - Assign a title to each section that reflects the main theme.
        - For each section, write a concise summary of what was discussed.
        - Include 3–5 direct quotes from the customer that illustrate or support the summary. (you can use quotes multiple times if they are relevant to multiple sections)

        Use these standard section titles where appropriate, or create your own if needed:
        - Context About the User or Company  
        - Market Insights
        - Product Needs and Desires
        - User Journey
        - Product Feedback
        - Current Workflow and Pain Points  
        - Existing Alternatives and Workarounds  
        - Jobs To Be Done  
        - Reactions to the Product Idea  
        - Value Perceived / Resonance Points  
        - Objections, Uncertainties, or Concerns  
        - Willingness to Pay or Budget Sensitivity  
        - Key Quotes / Memorable Soundbites  

        Guidelines:
        1. Keep each section focused on one or two related ideas.
        2. Maintain the customer's original quotes when used.
        3. Avoid summarizing or interpreting beyond what's explicitly stated.
        4. Include interviewer comments when necessary for context.

        TRANSCRIPT:
        ${transcript}
        `
    });

    const interviewSections = result.object as InterviewSections;
    await updateInterviewSections(ctx, interviewId, interviewSections.sections);

    console.log(interviewSections);

    console.log(await getInterview(ctx, interviewId));
    
    return resp.json(result.object);
  } catch (error) {
    ctx.logger.error('Error running agent:', error);

    return resp.text('Sorry, there was an error processing your request.');
  }
}
